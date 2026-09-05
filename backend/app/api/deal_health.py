from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import require_internal_user
from app.db.session import get_db
from app.models.quotation import Quotation
from app.models.user import User
from app.services.deal_health import get_deal_health

router = APIRouter(
    prefix="/api/deal-health",
    tags=["Deal Health"],
)


@router.get("/quotes/{quote_id}")
async def quote_health(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quote = await db.scalar(
        select(Quotation)
        .options(selectinload(Quotation.lines))
        .where(Quotation.id == quote_id)
    )

    if not quote:
        from fastapi import HTTPException
        raise HTTPException(404, "Quotation not found")

    alerts = await get_deal_health(db, quote)

    return {
        "quotationId": quote.id,
        "quoteNumber": quote.quote_number,
        "status": quote.status.value,
        "riskScore": quote.risk_score,
        "grossMarginPercent": quote.gross_margin_percent,
        "alerts": alerts,
        "health": (
            "AT_RISK"
            if alerts
            else "HEALTHY"
        ),
    }


@router.get("/dashboard")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    quotes = await db.scalars(
        select(Quotation)
        .order_by(Quotation.updated_at.desc())
    )

    results = []

    for quote in quotes.all():
        alerts = await get_deal_health(db, quote)

        if alerts:
            results.append({
                "quotationId": quote.id,
                "quoteNumber": quote.quote_number,
                "customerId": quote.customer_id,
                "status": quote.status.value,
                "alerts": alerts,
            })

    return {
        "totalAtRisk": len(results),
        "deals": results,
    }