from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_internal_user
from app.db.session import get_db
from app.models.customer_contact import CustomerContact
from app.models.negotiation_request import NegotiationRequest
from app.models.portal_session import PortalSession
from app.models.quotation import Quotation
from app.models.user import User
from app.models.enums import QuoteStatus
from app.schemas.portal import (
    NegotiationRequestCreate,
    NegotiationRequestResponse,
    NegotiationResolveRequest,
    PortalQuoteResponse,
    PortalShareResponse,
)
from app.services.portal import (
    authenticate_portal_token,
    confirm_portal_quote,
    create_negotiation_request,
    create_portal_session,
    get_portal_quote,
    list_negotiation_requests,
    portal_quote_dict,
    resolve_negotiation_request,
)


router = APIRouter(
    prefix="/api/portal",
    tags=["Customer Portal"],
)


async def get_portal_session(
    x_portal_token: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> PortalSession:
    try:
        return await authenticate_portal_token(
            db,
            x_portal_token,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
        ) from exc


@router.post(
    "/quotes/{quote_id}/share",
    response_model=PortalShareResponse,
)
async def share_quote(
    quote_id: str,
    contact_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await db.get(
        Quotation,
        quote_id,
    )

    if not quote:
        raise HTTPException(
            status_code=404,
            detail="Quotation not found.",
        )

    if quote.status not in {
        QuoteStatus.APPROVED,
        QuoteStatus.SENT,
    }:
        raise HTTPException(
            status_code=409,
            detail="Only approved quotations can be shared with customers.",
        )

    contact = await db.get(
        CustomerContact,
        contact_id,
    )

    if not contact:
        raise HTTPException(
            status_code=404,
            detail="Customer contact not found.",
        )

    try:
        raw_token, session = (
            await create_portal_session(
                db,
                quote,
                contact,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    if quote.status == QuoteStatus.APPROVED:
        quote.status = QuoteStatus.SENT
        await db.commit()

    return {
        "portal_url": (
            f"/portal/quote-access?token={raw_token}"
        ),
        "expires_at": session.expires_at,
    }


@router.get(
    "/quote",
    response_model=PortalQuoteResponse,
)
async def get_customer_quote(
    session: PortalSession = Depends(
        get_portal_session
    ),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await get_portal_quote(
            db,
            session,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc

    return portal_quote_dict(quote)


@router.post(
    "/negotiations",
    response_model=NegotiationRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_negotiation(
    data: NegotiationRequestCreate,
    session: PortalSession = Depends(
        get_portal_session
    ),
    db: AsyncSession = Depends(get_db),
):
    try:
        request = (
            await create_negotiation_request(
                db,
                session,
                data,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    return request


@router.get(
    "/negotiations",
    response_model=list[NegotiationRequestResponse],
)
async def get_negotiations(
    session: PortalSession = Depends(
        get_portal_session
    ),
    db: AsyncSession = Depends(get_db),
):
    return await list_negotiation_requests(
        db,
        session,
    )


@router.post(
    "/confirm",
)
async def confirm_quote(
    session: PortalSession = Depends(
        get_portal_session
    ),
    db: AsyncSession = Depends(get_db),
):
    try:
        quote = await confirm_portal_quote(
            db,
            session,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    return {
        "quotation_id": quote.id,
        "status": quote.status.value,
        "approval_version": quote.approval_version,
        "message": (
            "Quotation confirmed."
            if quote.status.value == "confirmed"
            else "Quotation requires re-approval."
        ),
    }


# Internal sales/manager action
@router.post(
    "/negotiations/{request_id}/resolve",
    response_model=NegotiationRequestResponse,
)
async def resolve_negotiation(
    request_id: str,
    data: NegotiationResolveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_internal_user),
):
    request = await db.get(
        NegotiationRequest,
        request_id,
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Negotiation request not found.",
        )

    try:
        # Find a valid session belonging to this customer/contact.
        session = await db.scalar(
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
        )

        if not session:
            raise ValueError(
                "No active portal session exists."
            )

        await resolve_negotiation_request(
            db,
            request,
            user.id,
            data.action,
            data.resolution_note,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    await db.refresh(request)

    return request