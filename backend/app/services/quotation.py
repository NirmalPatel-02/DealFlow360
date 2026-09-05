from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.enums import QuoteStatus, UserRole
from app.models.user import User
from app.models.price_list import PriceList
from app.models.price_list_item import PriceListItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.quotation import Quotation
from app.models.quote_line import QuoteLine
from app.schemas.quotation import (
    QuoteLineCreate,
    QuoteLineUpdate,
    QuotationCreate,
    QuotationUpdate,
)
from app.services.discount_governance import evaluate_discount


MONEY = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


async def generate_quote_number(db: AsyncSession) -> str:
    result = await db.scalar(
        select(Quotation.quote_number)
        .order_by(desc(Quotation.quote_number))
        .limit(1)
    )

    if not result:
        return "Q-100001"

    try:
        number = int(result.split("-")[-1])
    except (ValueError, AttributeError):
        number = 100000

    return f"Q-{number + 1:06d}"


async def create_quotation(
    db: AsyncSession,
    user_id: str,
    data: QuotationCreate,
) -> Quotation:
    customer = await db.get(Customer, data.customer_id)

    if not customer or not customer.is_active:
        raise ValueError("Active customer not found.")

    quote = Quotation(
        quote_number=await generate_quote_number(db),
        customer_id=customer.id,
        created_by_user_id=user_id,
        customer_tier_snapshot=customer.tier,
        currency=customer.currency.upper(),
        notes=data.notes,
        valid_until=data.valid_until,
    )

    db.add(quote)
    await db.commit()
    await db.refresh(quote)

    return quote


async def get_quotation(
    db: AsyncSession,
    quote_id: str,
) -> Quotation | None:
    result = await db.execute(
        select(Quotation)
        .options(selectinload(Quotation.lines))
        .where(Quotation.id == quote_id)
    )

    return result.scalar_one_or_none()


async def list_quotations(
    db: AsyncSession,
    user: User | str,
    status_value: QuoteStatus | None = None,
    customer_id: str | None = None,
) -> list[Quotation]:
    query = select(Quotation).order_by(desc(Quotation.created_at))

    role = getattr(user, "role", None)
    user_id = getattr(user, "id", user)

    # Sales Reps only see quotations they created; Managers, Finance, and Admins supervise all deals
    if role == UserRole.SALES_REP:
        query = query.where(Quotation.created_by_user_id == user_id)

    if status_value:
        query = query.where(Quotation.status == status_value)

    if customer_id:
        query = query.where(Quotation.customer_id == customer_id)

    result = await db.scalars(query)

    return list(result.all())


async def update_quotation(
    db: AsyncSession,
    quote: Quotation,
    data: QuotationUpdate,
) -> Quotation:
    if quote.status != QuoteStatus.DRAFT:
        raise ValueError("Only draft quotations can be edited.")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(quote, field, value)

    await db.commit()
    return await get_quotation(db, quote.id)


async def _resolve_price(
    db: AsyncSession,
    quote: Quotation,
    product: Product,
    variant_id: str | None,
) -> Decimal:
    price_list = await db.scalar(
        select(PriceList)
        .where(
            PriceList.customer_tier == quote.customer_tier_snapshot,
            PriceList.currency == quote.currency,
            PriceList.is_active.is_(True),
        )
        .order_by(PriceList.created_at.desc())
    )

    if not price_list:
        raise ValueError(
            "No active price list exists for this customer's tier "
            "and currency."
        )

    item = await db.scalar(
        select(PriceListItem).where(
            PriceListItem.price_list_id == price_list.id,
            PriceListItem.product_id == product.id,
            PriceListItem.variant_id == variant_id,
        )
    )

    if not item:
        raise ValueError(
            f"No price configured for product '{product.code}' "
            "in the customer's price list."
        )

    return item.price


async def add_quote_line(
    db: AsyncSession,
    quote: Quotation,
    data: QuoteLineCreate,
) -> QuoteLine:
    if quote.status != QuoteStatus.DRAFT:
        raise ValueError("Only draft quotations can be modified.")

    product = await db.get(Product, data.product_id)

    if not product or not product.is_active:
        raise ValueError("Active product not found.")

    variant = None

    if data.variant_id:
        variant = await db.get(
            ProductVariant,
            data.variant_id,
        )

        if not variant:
            raise ValueError("Product variant not found.")

        if variant.product_id != product.id:
            raise ValueError(
                "Selected variant does not belong to this product."
            )

    # Subscription/one-time consistency.
    if (
        data.line_type.value == "recurring"
        and product.product_type.value != "subscription"
    ):
        raise ValueError(
            "Only subscription products can be added as recurring lines."
        )

    unit_price = await _resolve_price(
        db,
        quote,
        product,
        data.variant_id,
    )

    if variant:
        unit_price += variant.extra_price

    evaluation = await evaluate_discount(
        db,
        quote.customer_tier_snapshot,
        product.category_id,
        data.discount_percent,
    )

    existing_line = await db.scalar(
        select(QuoteLine).where(
            QuoteLine.quotation_id == quote.id,
            QuoteLine.product_id == product.id,
            QuoteLine.variant_id == data.variant_id,
        )
    )

    if existing_line:
        raise ValueError(
            "This product/variant is already present in the quotation."
        )

    line_number = (
        await db.scalar(
            select(QuoteLine.line_number)
            .where(QuoteLine.quotation_id == quote.id)
            .order_by(desc(QuoteLine.line_number))
            .limit(1)
        )
        or 0
    ) + 1

    gross = money(unit_price * data.quantity)

    discount_amount = money(
        gross * data.discount_percent / Decimal("100")
    )

    net = money(gross - discount_amount)

    tax_amount = money(
        net * product.tax_rate / Decimal("100")
    )

    line_total = money(net + tax_amount)

    line_cost = money(
        product.cost_price * data.quantity
    )

    margin = money(net - line_cost)

    line = QuoteLine(
        quotation_id=quote.id,
        line_number=line_number,
        product_id=product.id,
        variant_id=variant.id if variant else None,
        line_type=data.line_type,
        description_snapshot=product.description or product.name,
        quantity=data.quantity,
        unit_price=unit_price,
        unit_cost=product.cost_price,
        discount_percent=data.discount_percent,
        discount_amount=discount_amount,
        tax_rate=product.tax_rate,
        line_subtotal=gross,
        line_total=line_total,
        line_cost=line_cost,
        margin_amount=margin,
        notes=data.notes,
    )

    db.add(line)
    await db.flush()

    await recalculate_quotation(db, quote)

    await db.commit()
    await db.refresh(line)

    return line


async def update_quote_line(
    db: AsyncSession,
    quote: Quotation,
    line: QuoteLine,
    data: QuoteLineUpdate,
) -> QuoteLine:
    if quote.status != QuoteStatus.DRAFT:
        raise ValueError("Only draft quotations can be modified.")

    changes = data.model_dump(exclude_unset=True)

    quantity = changes.get("quantity", line.quantity)
    discount = changes.get(
        "discount_percent",
        line.discount_percent,
    )

    product = await db.get(Product, line.product_id)

    if not product or not product.is_active:
        raise ValueError("Product is no longer active.")

    await evaluate_discount(
        db,
        quote.customer_tier_snapshot,
        product.category_id,
        discount,
    )

    gross = money(line.unit_price * quantity)

    discount_amount = money(
        gross * discount / Decimal("100")
    )

    net = money(gross - discount_amount)

    tax_amount = money(
        net * line.tax_rate / Decimal("100")
    )

    line_total = money(net + tax_amount)

    line_cost = money(
        line.unit_cost * quantity
    )

    for field, value in changes.items():
        if field in {"quantity", "discount_percent", "notes"}:
            setattr(line, field, value)

    line.discount_amount = discount_amount
    line.line_subtotal = gross
    line.line_total = line_total
    line.line_cost = line_cost
    line.margin_amount = money(net - line_cost)

    await recalculate_quotation(db, quote)

    await db.commit()
    await db.refresh(line)

    return line


async def delete_quote_line(
    db: AsyncSession,
    quote: Quotation,
    line: QuoteLine,
) -> None:
    if quote.status != QuoteStatus.DRAFT:
        raise ValueError("Only draft quotations can be modified.")

    await db.delete(line)
    await db.flush()

    remaining = await db.scalars(
        select(QuoteLine)
        .where(QuoteLine.quotation_id == quote.id)
        .order_by(QuoteLine.line_number)
    )

    for index, current_line in enumerate(
        remaining.all(),
        start=1,
    ):
        current_line.line_number = index

    await recalculate_quotation(db, quote)

    await db.commit()


async def recalculate_quotation(
    db: AsyncSession,
    quote: Quotation,
) -> Quotation:
    lines = await db.scalars(
        select(QuoteLine)
        .where(QuoteLine.quotation_id == quote.id)
    )

    lines = list(lines.all())

    quote.subtotal = money(
        sum(
            (line.line_subtotal for line in lines),
            Decimal("0"),
        )
    )

    quote.discount_total = money(
        sum(
            (line.discount_amount for line in lines),
            Decimal("0"),
        )
    )

    quote.tax_total = money(
        sum(
            (
                line.line_total
                - (line.line_subtotal - line.discount_amount)
                for line in lines
            ),
            Decimal("0"),
        )
    )

    quote.grand_total = money(
        sum(
            (line.line_total for line in lines),
            Decimal("0"),
        )
    )

    quote.total_cost = money(
        sum(
            (line.line_cost for line in lines),
            Decimal("0"),
        )
    )

    net_revenue = money(
        quote.grand_total - quote.tax_total
    )

    quote.gross_margin = money(
        net_revenue - quote.total_cost
    )

    if net_revenue > 0:
        quote.gross_margin_percent = (
            quote.gross_margin / net_revenue * Decimal("100")
        ).quantize(Decimal("0.01"))
    else:
        quote.gross_margin_percent = Decimal("0.00")

    # Temporary line-level risk aggregation.
    # Full blended scoring comes in the Deal Engine module.
    risk = Decimal("0")

    for line in lines:
        product = await db.get(Product, line.product_id)

        if not product:
            continue

        evaluation = await evaluate_discount(
            db,
            quote.customer_tier_snapshot,
            product.category_id,
            line.discount_percent,
        )

        risk += evaluation["excess_percent"]

    quote.risk_score = risk

    return quote