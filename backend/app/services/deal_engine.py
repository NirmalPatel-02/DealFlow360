import json
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import ApprovalLevel, QuoteStatus
from app.models.approval_band import ApprovalBand
from app.models.enums import ApprovalLevel
from app.models.product import Product
from app.models.quote_approval import QuoteApproval
from app.models.quotation import Quotation
from app.models.quote_line import QuoteLine
from app.services.discount_governance import evaluate_discount
from app.utils.time import utcnow


MONEY = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


LEVEL_PRIORITY = {
    ApprovalLevel.MANAGER: 1,
    ApprovalLevel.MANAGER_FINANCE: 2,
}


async def evaluate_quote(
    db: AsyncSession,
    quote: Quotation,
) -> dict:
    lines = list(
        (
            await db.scalars(
                select(QuoteLine)
                .where(QuoteLine.quotation_id == quote.id)
                .order_by(QuoteLine.line_number)
            )
        ).all()
    )

    if not lines:
        raise ValueError("Quotation must contain at least one line.")

    total_net = Decimal("0")
    weighted_excess = Decimal("0")
    max_excess = Decimal("0")
    highest_level = None
    violations = []

    for line in lines:
        product = await db.get(Product, line.product_id)

        if not product:
            raise ValueError(
                f"Product for line {line.line_number} no longer exists."
            )

        result = await evaluate_discount(
            db,
            quote.customer_tier_snapshot,
            product.category_id,
            line.discount_percent,
        )

        net_before_tax = money(
            line.line_subtotal - line.discount_amount
        )

        total_net += net_before_tax

        excess = result["excess_percent"]

        weighted_excess += excess * net_before_tax

        if excess > max_excess:
            max_excess = excess

        level = result["approval_level"]

        if level:
            if (
                highest_level is None
                or LEVEL_PRIORITY[level]
                > LEVEL_PRIORITY[highest_level]
            ):
                highest_level = level

            violations.append(
                {
                    "line_id": line.id,
                    "line_number": line.line_number,
                    "product_id": product.id,
                    "product_name": product.name,
                    "requested_discount_percent": str(
                        line.discount_percent
                    ),
                    "allowed_discount_percent": str(
                        result["allowed_discount_percent"]
                    ),
                    "excess_percent": str(excess),
                    "approval_level": level.value,
                }
            )

    blended_excess = (
        weighted_excess / total_net
        if total_net > 0
        else Decimal("0")
    )

    # Explainable 0-100 score.
    # Weighted average excess is the core signal;
    # maximum line excess captures severe single-line violations.
    raw_score = (
        blended_excess * Decimal("5")
        + max_excess * Decimal("5")
    )

    risk_score = min(
        raw_score,
        Decimal("100"),
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return {
        "risk_score": risk_score,
        "blended_excess_percent": blended_excess.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        ),
        "max_excess_percent": max_excess,
        "highest_approval_level": highest_level,
        "violations": violations,
        "requires_approval": highest_level is not None,
    }


async def persist_evaluation(
    db: AsyncSession,
    quote: Quotation,
    evaluation: dict,
) -> None:
    quote.risk_score = evaluation["risk_score"]
    quote.approval_level_required = (
        evaluation["highest_approval_level"].value
        if evaluation["highest_approval_level"]
        else None
    )
    quote.last_evaluated_at = utcnow()


async def submit_quote(
    db: AsyncSession,
    quote: Quotation,
) -> Quotation:
    if quote.status not in {
        QuoteStatus.DRAFT,
        QuoteStatus.REVISION_REQUIRED,
    }:
        raise ValueError(
            "Only draft or revision-required quotations can be submitted."
        )

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

    quote.submitted_at = utcnow()

    if not evaluation["requires_approval"]:
        quote.status = QuoteStatus.APPROVED
        quote.approved_at = utcnow()

        return quote

    quote.status = QuoteStatus.PENDING_APPROVAL

    chain_level = evaluation["highest_approval_level"]

    approval_steps = [
        ApprovalLevel.MANAGER,
    ]

    if chain_level == ApprovalLevel.MANAGER_FINANCE:
        approval_steps.append(
            ApprovalLevel.MANAGER_FINANCE
        )

    for index, level in enumerate(
        approval_steps,
        start=1,
    ):
        approval = QuoteApproval(
            quotation_id=quote.id,
            approval_version=quote.approval_version,
            step_order=index,
            approval_level=level,
        )

        db.add(approval)

    return quote


async def invalidate_old_approvals(
    db: AsyncSession,
    quote_id: str,
    current_version: int,
) -> None:
    approvals = list(
        (
            await db.scalars(
                select(QuoteApproval).where(
                    QuoteApproval.quotation_id == quote_id,
                    QuoteApproval.approval_version < current_version,
                )
            )
        ).all()
    )

    for approval in approvals:
        await db.delete(approval)


async def get_current_pending_approval(
    db: AsyncSession,
    quote: Quotation,
) -> QuoteApproval | None:
    approvals = list(
        (
            await db.scalars(
                select(QuoteApproval)
                .where(
                    QuoteApproval.quotation_id == quote.id,
                    QuoteApproval.approval_version
                    == quote.approval_version,
                )
                .order_by(QuoteApproval.step_order)
            )
        ).all()
    )

    for approval in approvals:
        if approval.status.value == "pending":
            return approval

    return None


async def act_on_approval(
    db: AsyncSession,
    quote: Quotation,
    approval: QuoteApproval,
    user_id: str,
    action: str,
    reason: str | None,
) -> Quotation:
    if quote.status != QuoteStatus.PENDING_APPROVAL:
        raise ValueError(
            "Quotation is not awaiting approval."
        )

    if approval.approval_version != quote.approval_version:
        raise ValueError(
            "This approval request belongs to an outdated quote version."
        )

    if approval.status.value != "pending":
        raise ValueError(
            "This approval step has already been acted upon."
        )

    if action not in {
        "approve",
        "reject",
        "return",
    }:
        raise ValueError("Invalid approval action.")

    if action in {"reject", "return"} and not reason:
        raise ValueError(
            "A reason is required when rejecting or returning a quote."
        )

    approval.acted_by_user_id = user_id
    approval.acted_at = utcnow()
    approval.reason = reason

    if action == "reject":
        approval.status = approval.status.REJECTED
        quote.status = QuoteStatus.REJECTED
        quote.rejected_at = utcnow()

        return quote

    if action == "return":
        approval.status = approval.status.RETURNED
        quote.status = QuoteStatus.REVISION_REQUIRED

        return quote

    approval.status = approval.status.APPROVED

    next_step = await db.scalar(
        select(QuoteApproval)
        .where(
            QuoteApproval.quotation_id == quote.id,
            QuoteApproval.approval_version == quote.approval_version,
            QuoteApproval.step_order > approval.step_order,
            QuoteApproval.status == approval.status.PENDING,
        )
        .order_by(QuoteApproval.step_order)
        .limit(1)
    )

    if next_step:
        return quote

    quote.status = quote.status.APPROVED
    quote.approved_at = utcnow()

    return quote