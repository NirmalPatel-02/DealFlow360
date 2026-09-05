import hashlib
import secrets

from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer_contact import CustomerContact
from app.models.enums import (
    ApprovalLevel,
    ApprovalStatus,
    NegotiationStatus,
    QuoteStatus,
)
from app.models.negotiation_request import NegotiationRequest
from app.models.portal_session import PortalSession
from app.models.product import Product
from app.models.quote_approval import QuoteApproval
from app.models.quote_line import QuoteLine
from app.models.quotation import Quotation
from app.models.audit_log import AuditLog

from app.schemas.portal import NegotiationRequestCreate
from app.services.deal_engine import (
    evaluate_quote,
    invalidate_old_approvals,
    persist_evaluation,
)
from app.services.quotation import recalculate_quotation
from app.utils.time import utcnow


PORTAL_SESSION_HOURS = 72


def hash_portal_token(token: str) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


async def create_portal_session(
    db: AsyncSession,
    quote: Quotation,
    contact: CustomerContact,
) -> tuple[str, PortalSession]:
    if contact.customer_id != quote.customer_id:
        raise ValueError(
            "Contact does not belong to this quotation's customer."
        )

    if not contact.portal_enabled:
        raise ValueError(
            "Portal access is not enabled for this contact."
        )

    raw_token = secrets.token_urlsafe(48)

    session = PortalSession(
        customer_contact_id=contact.id,
        quotation_id=quote.id,
        token_hash=hash_portal_token(raw_token),
        expires_at=utcnow()
        + timedelta(hours=PORTAL_SESSION_HOURS),
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    return raw_token, session


async def authenticate_portal_token(
    db: AsyncSession,
    raw_token: str,
) -> PortalSession:
    token_hash = hash_portal_token(raw_token)

    session = await db.scalar(
        select(PortalSession)
        .where(
            PortalSession.token_hash == token_hash,
            PortalSession.revoked_at.is_(None),
        )
    )

    if not session:
        raise ValueError(
            "Invalid portal session."
        )

    now = utcnow()

    if session.expires_at <= now:
        raise ValueError(
            "Portal session has expired."
        )

    session.last_used_at = now

    return session


async def get_portal_quote(
    db: AsyncSession,
    session: PortalSession,
) -> Quotation:
    result = await db.execute(
        select(Quotation)
        .options(
            selectinload(Quotation.lines)
        )
        .where(
            Quotation.id == session.quotation_id
        )
    )

    quote = result.scalar_one_or_none()

    if not quote:
        raise ValueError(
            "Quotation no longer exists."
        )

    contact = await db.get(
        CustomerContact,
        session.customer_contact_id,
    )

    if not contact:
        raise ValueError(
            "Customer contact no longer exists."
        )

    if contact.customer_id != quote.customer_id:
        raise ValueError(
            "Portal access does not match quotation customer."
        )

    return quote


def portal_quote_dict(
    quote: Quotation,
) -> dict:
    return {
        "id": quote.id,
        "quote_number": quote.quote_number,
        "status": quote.status.value,
        "currency": quote.currency,
        "subtotal": quote.subtotal,
        "discount_total": quote.discount_total,
        "tax_total": quote.tax_total,
        "grand_total": quote.grand_total,
        "valid_until": quote.valid_until,
        "lines": [
            {
                "id": line.id,
                "line_number": line.line_number,
                "product_name": (
                    line.product.name
                    if line.product
                    else line.description_snapshot
                ),
                "description": line.description_snapshot,
                "quantity": line.quantity,
                "unit_price": line.unit_price,
                "discount_percent": line.discount_percent,
                "line_total": line.line_total,
            }
            for line in quote.lines
        ],
    }


async def create_negotiation_request(
    db: AsyncSession,
    session: PortalSession,
    data: NegotiationRequestCreate,
) -> NegotiationRequest:
    quote = await get_portal_quote(
        db,
        session,
    )

    if quote.status not in {
        QuoteStatus.SENT,
        QuoteStatus.UNDER_NEGOTIATION,
    }:
        raise ValueError(
            "This quotation is not currently open for negotiation."
        )

    line = None

    if data.quote_line_id:
        line = await db.get(
            QuoteLine,
            data.quote_line_id,
        )

        if not line or line.quotation_id != quote.id:
            raise ValueError(
                "Quote line does not belong to this quotation."
            )

    if (
        data.requested_discount_percent is None
        and data.requested_quantity is None
        and data.message.strip() == ""
    ):
        raise ValueError(
            "Negotiation request cannot be empty."
        )

    if (
        data.requested_discount_percent is not None
        and not line
    ):
        raise ValueError(
            "A discount proposal requires a quote line."
        )

    if (
        data.requested_quantity is not None
        and not line
    ):
        raise ValueError(
            "A quantity proposal requires a quote line."
        )

    if (
        data.requested_quantity is not None
        and line
        and data.requested_quantity > 1_000_000
    ):
        raise ValueError(
            "Requested quantity is too large."
        )

    contact_id = session.customer_contact_id

    request = NegotiationRequest(
        quotation_id=quote.id,
        customer_contact_id=contact_id,
        quote_line_id=(
            line.id if line else None
        ),
        message=data.message.strip(),
        requested_discount_percent=(
            data.requested_discount_percent
        ),
        requested_quantity=(
            data.requested_quantity
        ),
        status=NegotiationStatus.OPEN,
    )

    db.add(request)

    quote.status = (
        QuoteStatus.UNDER_NEGOTIATION
    )

    await db.commit()
    await db.refresh(request)

    return request


async def list_negotiation_requests(
    db: AsyncSession,
    session: PortalSession,
) -> list[NegotiationRequest]:
    quote = await get_portal_quote(
        db,
        session,
    )

    result = await db.scalars(
        select(NegotiationRequest)
        .where(
            NegotiationRequest.quotation_id
            == quote.id,
            NegotiationRequest.customer_contact_id
            == session.customer_contact_id,
        )
        .order_by(
            NegotiationRequest.created_at.desc()
        )
    )

    return list(result.all())


async def _audit(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    action: str,
    reason: str | None = None,
    metadata: dict | None = None,
) -> None:
    import json

    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            reason=reason,
            metadata_json=(
                json.dumps(metadata)
                if metadata
                else None
            ),
            occurred_at=utcnow(),
        )
    )


async def _reenter_approval_after_change(
    db: AsyncSession,
    quote: Quotation,
) -> None:
    evaluation = await evaluate_quote(
        db,
        quote,
    )

    quote.approval_version += 1

    await invalidate_old_approvals(
        db,
        quote.id,
        quote.approval_version,
    )

    await persist_evaluation(
        db,
        quote,
        evaluation,
    )

    if not evaluation["requires_approval"]:
        quote.status = QuoteStatus.SENT
        return

    quote.status = QuoteStatus.PENDING_APPROVAL

    required_level = (
        evaluation["highest_approval_level"]
    )

    steps = [ApprovalLevel.MANAGER]

    if required_level == ApprovalLevel.MANAGER_FINANCE:
        steps.append(
            ApprovalLevel.MANAGER_FINANCE
        )

    for index, level in enumerate(
        steps,
        start=1,
    ):
        db.add(
            QuoteApproval(
                quotation_id=quote.id,
                approval_version=quote.approval_version,
                step_order=index,
                approval_level=level,
                status=ApprovalStatus.PENDING,
            )
        )


async def resolve_negotiation_request(
    db: AsyncSession,
    request: NegotiationRequest,
    actor_user_id: str,
    action: str,
    resolution_note: str | None,
) -> Quotation:
    if request.status != NegotiationStatus.OPEN:
        raise ValueError(
            "Negotiation request has already been resolved."
        )

    if action not in {"accept", "reject"}:
        raise ValueError(
            "Invalid negotiation action."
        )

    quote = await get_portal_quote(
        db,
        await db.scalar(
            select(PortalSession)
            .where(
                PortalSession.quotation_id
                == request.quotation_id,
                PortalSession.customer_contact_id
                == request.customer_contact_id,
                PortalSession.revoked_at.is_(None),
            )
            .order_by(
                PortalSession.created_at.desc()
            )
            .limit(1)
        ),
    )

    if action == "reject":
        request.status = (
            NegotiationStatus.REJECTED
        )
        request.resolved_by_user_id = actor_user_id
        request.resolved_at = utcnow()
        request.resolution_note = (
            resolution_note
        )

        remaining_open = await db.scalar(
            select(NegotiationRequest.id)
            .where(
                NegotiationRequest.quotation_id
                == quote.id,
                NegotiationRequest.status
                == NegotiationStatus.OPEN,
            )
            .limit(1)
        )

        if not remaining_open:
            quote.status = QuoteStatus.SENT

        await _audit(
            db,
            "quotation",
            quote.id,
            "NEGOTIATION_REJECTED",
            resolution_note,
        )

        await db.commit()

        return quote

    if not request.quote_line_id:
        request.status = (
            NegotiationStatus.ACCEPTED
        )
        request.resolved_by_user_id = actor_user_id
        request.resolved_at = utcnow()
        request.resolution_note = (
            resolution_note
        )

        await _audit(
            db,
            "quotation",
            quote.id,
            "CUSTOMER_CHANGE_ACCEPTED",
            resolution_note,
        )

        await db.commit()

        return quote

    line = await db.get(
        QuoteLine,
        request.quote_line_id,
    )

    if not line or line.quotation_id != quote.id:
        raise ValueError(
            "Negotiation quote line no longer exists."
        )

    if request.requested_discount_percent is not None:
        line.discount_percent = (
            request.requested_discount_percent
        )

    if request.requested_quantity is not None:
        line.quantity = (
            request.requested_quantity
        )

    # Recalculate the changed line safely.
    net = (
        line.unit_price
        * line.quantity
    )

    line.discount_amount = (
        net
        * line.discount_percent
        / Decimal("100")
    ).quantize(Decimal("0.01"))

    line.line_subtotal = (
        net.quantize(Decimal("0.01"))
    )

    discounted = (
        line.line_subtotal
        - line.discount_amount
    )

    tax = (
        discounted
        * line.tax_rate
        / Decimal("100")
    ).quantize(Decimal("0.01"))

    line.line_total = (
        discounted + tax
    ).quantize(Decimal("0.01"))

    line.line_cost = (
        line.unit_cost
        * line.quantity
    ).quantize(Decimal("0.01"))

    line.margin_amount = (
        discounted
        - line.line_cost
    ).quantize(Decimal("0.01"))

    await recalculate_quotation(
        db,
        quote,
    )

    request.status = NegotiationStatus.ACCEPTED
    request.resolved_by_user_id = actor_user_id
    request.resolved_at = utcnow()
    request.resolution_note = resolution_note

    await _reenter_approval_after_change(
        db,
        quote,
    )

    await _audit(
        db,
        "quotation",
        quote.id,
        "CUSTOMER_TERMS_CHANGED",
        resolution_note,
        {
            "quote_line_id": line.id,
            "requested_discount": (
                str(request.requested_discount_percent)
                if request.requested_discount_percent is not None
                else None
            ),
            "requested_quantity": (
                str(request.requested_quantity)
                if request.requested_quantity is not None
                else None
            ),
            "approval_version": quote.approval_version,
        },
    )

    await db.commit()

    return quote


async def confirm_portal_quote(
    db: AsyncSession,
    session: PortalSession,
) -> Quotation:
    quote = await get_portal_quote(
        db,
        session,
    )

    if quote.status not in {
        QuoteStatus.SENT,
        QuoteStatus.UNDER_NEGOTIATION,
    }:
        raise ValueError(
            "Quotation cannot be confirmed in its current state."
        )

    open_request = await db.scalar(
        select(NegotiationRequest.id)
        .where(
            NegotiationRequest.quotation_id
            == quote.id,
            NegotiationRequest.status
            == NegotiationStatus.OPEN,
        )
        .limit(1)
    )

    if open_request:
        raise ValueError(
            "Quotation has unresolved negotiation requests."
        )

    evaluation = await evaluate_quote(
        db,
        quote,
    )

    if evaluation["requires_approval"]:
        quote.approval_version += 1

        await invalidate_old_approvals(
            db,
            quote.id,
            quote.approval_version,
        )

        await persist_evaluation(
            db,
            quote,
            evaluation,
        )

        quote.status = (
            QuoteStatus.PENDING_APPROVAL
        )

        steps = [ApprovalLevel.MANAGER]

        if (
            evaluation["highest_approval_level"]
            == ApprovalLevel.MANAGER_FINANCE
        ):
            steps.append(
                ApprovalLevel.MANAGER_FINANCE
            )

        for index, level in enumerate(
            steps,
            start=1,
        ):
            db.add(
                QuoteApproval(
                    quotation_id=quote.id,
                    approval_version=quote.approval_version,
                    step_order=index,
                    approval_level=level,
                    status=ApprovalStatus.PENDING,
                )
            )

        await _audit(
            db,
            "quotation",
            quote.id,
            "CUSTOMER_CONFIRMATION_REQUIRES_REAPPROVAL",
        )

        await db.commit()

        return quote

    quote.status = QuoteStatus.CONFIRMED

    await _audit(
        db,
        "quotation",
        quote.id,
        "CUSTOMER_CONFIRMED",
        metadata={
            "contact_id": session.customer_contact_id,
        },
    )

    await db.commit()

    return quote