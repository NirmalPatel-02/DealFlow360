from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_internal_user
from app.db.session import get_db
from app.models.billing import Invoice, Order
from app.models.quotation import Quotation
from app.models.quote_line import QuoteLine
from app.models.user import User

router = APIRouter(
    prefix="/api/reports",
    tags=["Reporting"],
)


@router.get("/sales")
async def sales_report(
    from_date: date | None = Query(None, alias="fromDate"),
    to_date: date | None = Query(None, alias="toDate"),
    sales_rep_id: str | None = Query(None),
    approval_status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    query = select(Quotation)

    if from_date:
        query = query.where(
            Quotation.created_at >= from_date
        )

    if to_date:
        query = query.where(
            Quotation.created_at < to_date
        )

    if sales_rep_id:
        query = query.where(
            Quotation.created_by_user_id == sales_rep_id
        )

    if approval_status:
        query = query.where(
            Quotation.status == approval_status
        )

    result = await db.scalars(
        query.order_by(Quotation.created_at.desc())
    )

    quotes = list(result.all())

    total_quotes = len(quotes)
    total_value = sum(
        (q.grand_total for q in quotes),
        0,
    )

    approved = sum(
        1
        for q in quotes
        if q.status.value == "approved"
    )

    confirmed = sum(
        1
        for q in quotes
        if q.status.value == "confirmed"
    )

    return {
        "filters": {
            "fromDate": from_date,
            "toDate": to_date,
            "salesRepId": sales_rep_id,
            "approvalStatus": approval_status,
        },
        "summary": {
            "quoteCount": total_quotes,
            "quoteValue": total_value,
            "approvedQuotes": approved,
            "confirmedQuotes": confirmed,
        },
        "quotations": [
            {
                "id": q.id,
                "quoteNumber": q.quote_number,
                "customerId": q.customer_id,
                "status": q.status.value,
                "grandTotal": q.grand_total,
                "marginPercent": q.gross_margin_percent,
                "riskScore": q.risk_score,
                "createdAt": q.created_at,
            }
            for q in quotes
        ],
    }


@router.get("/billing")
async def billing_report(
    from_date: date | None = Query(None, alias="fromDate"),
    to_date: date | None = Query(None, alias="toDate"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_internal_user),
):
    query = select(Invoice)

    if from_date:
        query = query.where(
            Invoice.created_at >= from_date
        )

    if to_date:
        query = query.where(
            Invoice.created_at < to_date
        )

    invoices = list(
        (await db.scalars(
            query.order_by(Invoice.created_at.desc())
        )).all()
    )

    return {
        "invoiceCount": len(invoices),
        "issuedAmount": sum(
            (i.total_amount for i in invoices),
            0,
        ),
        "paidAmount": sum(
            (i.amount_paid for i in invoices),
            0,
        ),
        "dueAmount": sum(
            (i.amount_due for i in invoices),
            0,
        ),
        "invoices": [
            {
                "id": i.id,
                "invoiceNumber": i.invoice_number,
                "orderId": i.order_id,
                "customerId": i.customer_id,
                "status": i.status,
                "totalAmount": i.total_amount,
                "amountPaid": i.amount_paid,
                "amountDue": i.amount_due,
            }
            for i in invoices
        ],
    }