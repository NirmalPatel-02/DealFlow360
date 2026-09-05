from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.db.session import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.product import Product
from app.models.quotation import Quotation
from app.models.billing import Order, Invoice

router = APIRouter(
    prefix="/api/admin/dashboard",
    tags=["Admin Dashboard"],
)


@router.get("/summary")
async def summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    users = await db.scalar(
        select(func.count()).select_from(User)
    )

    customers = await db.scalar(
        select(func.count())
        .select_from(Customer)
        .where(Customer.is_active.is_(True))
    )

    products = await db.scalar(
        select(func.count())
        .select_from(Product)
        .where(Product.is_active.is_(True))
    )

    quotations = await db.scalar(
        select(func.count()).select_from(Quotation)
    )

    orders = await db.scalar(
        select(func.count()).select_from(Order)
    )

    invoices = await db.scalar(
        select(func.count()).select_from(Invoice)
    )

    revenue = await db.scalar(
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .select_from(Order)
        .where(Order.status == "CONFIRMED")
    )

    return {
        "users": users or 0,
        "activeCustomers": customers or 0,
        "activeProducts": products or 0,
        "quotations": quotations or 0,
        "orders": orders or 0,
        "invoices": invoices or 0,
        "confirmedRevenue": revenue or 0,
    }