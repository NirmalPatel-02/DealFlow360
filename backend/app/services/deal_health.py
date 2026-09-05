from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quotation import Quotation
from app.models.quote_approval import QuoteApproval
from app.models.enums import QuoteStatus, ApprovalStatus
from app.models.fulfillment_plan import FulfillmentPlan


STALL_DAYS = 3
DISCOUNT_ANOMALY_PERCENT = Decimal("25")
DELIVERY_SLIPPAGE_DAYS = 2


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_deal_health(
    db: AsyncSession,
    quotation: Quotation,
) -> list[dict]:
    alerts = []

    now = utcnow()

    if quotation.status in {
        QuoteStatus.DRAFT,
        QuoteStatus.SENT,
        QuoteStatus.UNDER_NEGOTIATION,
        QuoteStatus.PENDING_APPROVAL,
    }:
        age = now - quotation.updated_at

        if age >= timedelta(days=STALL_DAYS):
            alerts.append({
                "type": "STALLED_DEAL",
                "severity": "HIGH",
                "message": (
                    f"Quotation has had no activity for "
                    f"{age.days} days."
                ),
            })

    if quotation.risk_score >= DISCOUNT_ANOMALY_PERCENT:
        alerts.append({
            "type": "DISCOUNT_ANOMALY",
            "severity": "HIGH",
            "message": (
                "Quotation discount/risk is significantly "
                "above normal policy tolerance."
            ),
        })

    if quotation.gross_margin_percent < Decimal("10.00"):
        alerts.append({
            "type": "LOW_MARGIN",
            "severity": "HIGH",
            "message": "Gross margin is below 10%.",
        })

    if quotation.status == QuoteStatus.PENDING_APPROVAL:
        pending = await db.scalar(
            select(QuoteApproval.id)
            .where(
                QuoteApproval.quotation_id == quotation.id,
                QuoteApproval.status == ApprovalStatus.PENDING,
            )
            .limit(1)
        )

        if pending:
            age = now - quotation.submitted_at if quotation.submitted_at else timedelta(0)

            if age >= timedelta(days=2):
                alerts.append({
                    "type": "APPROVAL_STALE",
                    "severity": "MEDIUM",
                    "message": "Approval has been pending for more than 2 days.",
                })

    plan = await db.scalar(
        select(FulfillmentPlan).where(
            FulfillmentPlan.quotation_id == quotation.id
        )
    )

    if plan and plan.status.value == "BACKORDERED":
        alerts.append({
            "type": "BACKORDER",
            "severity": "MEDIUM",
            "message": "Quotation contains outstanding backordered quantity.",
        })

    return alerts