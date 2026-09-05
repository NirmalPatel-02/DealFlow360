from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4
from app.models.quotation import Quotation
from app.models.quote_line import QuoteLine
from app.models.enums import QuoteStatus
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.billing import (
    BillingAuditLog,
    BillingSchedule,
    CreditNote,
    Invoice,
    InvoiceItem,
    Order,
    OrderItem,
    Payment,
    Subscription,
    SubscriptionPlan,
)
from app.utils.time import utcnow

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def add_interval(value: date, interval: str) -> date:
    months = {"MONTHLY": 1, "QUARTERLY": 3, "YEARLY": 12}[interval]
    month = value.month - 1 + months
    year, month = value.year + month // 12, month % 12 + 1
    return value.replace(year=year, month=month, day=min(value.day, monthrange(year, month)[1]))


def calculate_proration(old_quantity: Decimal, old_unit_price: Decimal, new_quantity: Decimal, new_unit_price: Decimal, remaining_days: int, total_days: int) -> Decimal:
    if total_days <= 0 or remaining_days <= 0:
        return Decimal("0.00")
    return money((new_quantity * new_unit_price - old_quantity * old_unit_price) * Decimal(remaining_days) / Decimal(total_days))


def audit(db, *, order_id, action, performed_by, invoice_id=None, payment_id=None, subscription_id=None, old=None, new=None, reason=None):
    db.add(BillingAuditLog(
        order_id=order_id, invoice_id=invoice_id, payment_id=payment_id,
        subscription_id=subscription_id, action=action, performed_by=performed_by,
        old_value=old, new_value=new, reason=reason, created_at=utcnow(),
    ))


async def get_order(db: AsyncSession, order_id: str) -> Order:
    result = await db.execute(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Only confirmed orders can be billed")
    return order


async def create_order(db: AsyncSession, payload, performed_by: str) -> Order:
    order = Order(customer_id=payload.customer_id, order_number=f"ORD-{uuid4().hex[:10].upper()}", status=payload.status, currency=payload.currency.upper(), confirmed_at=utcnow())
    subtotal = discount = tax = Decimal("0")
    for item in payload.items:
        if item.billing_type not in {"ONE_TIME", "RECURRING"}:
            raise HTTPException(400, "billing_type must be ONE_TIME or RECURRING")
        base = item.quantity * item.unit_price
        item_discount = money(base * item.discount_percent / 100)
        item_tax = money((base - item_discount) * item.tax_percent / 100)
        item_total = money(base - item_discount + item_tax)
        order.items.append(OrderItem(
            product_id=item.product_id, product_name_snapshot=item.product_name,
            quantity=item.quantity, unit_price=item.unit_price, billing_type=item.billing_type,
            discount_percent=item.discount_percent, discount_amount=item_discount,
            tax_amount=item_tax, total_amount=item_total,
            subscription_plan_id=item.subscription_plan_id,
            recurring_unit="month" if item.billing_type == "RECURRING" else None,
            recurring_interval=1 if item.billing_type == "RECURRING" else None,
            billing_start_date=date.today() if item.billing_type == "RECURRING" else None,
        ))
        subtotal += base
        discount += item_discount
        tax += item_tax
    order.subtotal, order.discount_amount, order.tax_amount = money(subtotal), money(discount), money(tax)
    order.total_amount = money(subtotal - discount + tax)
    db.add(order)
    await db.flush()
    audit(db, order_id=order.id, action="ORDER_CREATED", performed_by=performed_by, new=str(order.total_amount))
    return order


async def create_invoice(db: AsyncSession, order_id: str, performed_by: str) -> Invoice:
    order = await get_order(db, order_id)
    existing = await db.execute(select(Invoice).where(Invoice.order_id == order.id, Invoice.invoice_type == "ONE_TIME"))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "One-time invoice already exists for this order")
    items = [item for item in order.items if item.billing_type == "ONE_TIME"]
    if not items:
        raise HTTPException(400, "Order has no one-time items")
    invoice = Invoice(
        order_id=order.id, customer_id=order.customer_id, invoice_number=f"INV-{uuid4().hex[:10].upper()}",
        invoice_type="ONE_TIME", status="ISSUED", currency=order.currency,
        subtotal=sum((item.quantity * item.unit_price for item in items), Decimal("0")),
        discount_amount=sum((item.discount_amount for item in items), Decimal("0")),
        tax_amount=sum((item.tax_amount for item in items), Decimal("0")),
        due_date=date.today() + timedelta(days=30), issued_at=utcnow(),
    )
    invoice.total_amount = money(invoice.subtotal - invoice.discount_amount + invoice.tax_amount)
    invoice.amount_due = invoice.total_amount
    for item in items:
        invoice.items.append(InvoiceItem(
            order_item_id=item.id, description=item.product_name_snapshot, quantity=item.quantity,
            unit_price=item.unit_price, discount_amount=item.discount_amount, tax_amount=item.tax_amount,
            total_amount=item.total_amount,
        ))
    db.add(invoice)
    await db.flush()
    audit(db, order_id=order.id, invoice_id=invoice.id, action="INVOICE_CREATED", performed_by=performed_by, new=invoice.invoice_number)
    await db.commit()
    await db.refresh(invoice)
    return invoice

async def create_one_time_invoice_if_needed(
    db: AsyncSession,
    order_id: str,
    performed_by: str,
) -> Invoice | None:
    order = await get_order(db, order_id)

    existing = await db.scalar(
        select(Invoice)
        .where(
            Invoice.order_id == order.id,
            Invoice.invoice_type == "ONE_TIME",
            Invoice.status != "CANCELLED",
        )
    )

    if existing:
        return existing

    items = [
        item
        for item in order.items
        if item.billing_type == "ONE_TIME"
    ]

    if not items:
        return None

    subtotal = money(
        sum(
            (item.quantity * item.unit_price for item in items),
            Decimal("0.00"),
        )
    )

    discount = money(
        sum(
            (item.discount_amount for item in items),
            Decimal("0.00"),
        )
    )

    tax = money(
        sum(
            (item.tax_amount for item in items),
            Decimal("0.00"),
        )
    )

    total = money(subtotal - discount + tax)

    invoice = Invoice(
        order_id=order.id,
        customer_id=order.customer_id,
        invoice_number=f"INV-{uuid4().hex[:10].upper()}",
        invoice_type="ONE_TIME",
        status="ISSUED",
        currency=order.currency,
        subtotal=subtotal,
        discount_amount=discount,
        tax_amount=tax,
        total_amount=total,
        amount_paid=Decimal("0.00"),
        amount_due=total,
        due_date=date.today() + timedelta(days=30),
        issued_at=utcnow(),
    )

    for item in items:
        invoice.items.append(
            InvoiceItem(
                order_item_id=item.id,
                description=item.product_name_snapshot,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_amount=item.discount_amount,
                tax_amount=item.tax_amount,
                total_amount=item.total_amount,
            )
        )

    db.add(invoice)
    await db.flush()

    audit(
        db,
        order_id=order.id,
        invoice_id=invoice.id,
        action="ONE_TIME_INVOICE_CREATED",
        performed_by=performed_by,
        new=invoice.invoice_number,
    )

    return invoice

async def record_payment(db: AsyncSession, invoice_id: str, payload, performed_by: str) -> Payment:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id).with_for_update())
    invoice = result.scalar_one_or_none()
    if not invoice or invoice.status in {"CANCELLED", "VOID", "PAID"}:
        raise HTTPException(400, "Invoice is not payable")
    amount = money(payload.amount)
    if amount > invoice.amount_due:
        raise HTTPException(400, "Payment amount exceeds invoice amount due")
    duplicate = await db.execute(select(Payment).where(Payment.payment_reference == payload.payment_reference))
    if duplicate.scalar_one_or_none():
        raise HTTPException(409, "Payment reference already exists")
    payment = Payment(
        invoice_id=invoice.id, order_id=invoice.order_id, customer_id=invoice.customer_id,
        payment_reference=payload.payment_reference, amount=amount, refunded_amount=0,
        currency=invoice.currency, payment_method=payload.payment_method, status="SUCCESS", paid_at=utcnow(),
    )
    invoice.amount_paid = money(invoice.amount_paid + amount)
    invoice.amount_due = money(invoice.total_amount - invoice.amount_paid)
    invoice.status = "PAID" if invoice.amount_due == 0 else "PARTIALLY_PAID"
    if invoice.status == "PAID":
        invoice.paid_at = utcnow()
    db.add(payment)
    await db.flush()
    audit(db, order_id=invoice.order_id, invoice_id=invoice.id, payment_id=payment.id, action="PAYMENT_RECORDED", performed_by=performed_by, new=str(amount))
    await db.commit()
    await db.refresh(payment)
    return payment


async def refund_payment(db: AsyncSession, payment_id: str, payload, performed_by: str) -> Payment:
    result = await db.execute(select(Payment).options(selectinload(Payment.invoice)).where(Payment.id == payment_id).with_for_update())
    payment = result.scalar_one_or_none()
    if not payment or payment.status not in {"SUCCESS", "PARTIALLY_REFUNDED"}:
        raise HTTPException(400, "Payment cannot be refunded")
    refundable = payment.amount - payment.refunded_amount
    amount = money(payload.amount or refundable)
    if amount > refundable:
        raise HTTPException(400, "Refund amount exceeds refundable amount")
    payment.refunded_amount = money(payment.refunded_amount + amount)
    payment.status = "REFUNDED" if payment.refunded_amount == payment.amount else "PARTIALLY_REFUNDED"
    invoice = payment.invoice
    invoice.amount_paid = money(invoice.amount_paid - amount)
    invoice.amount_due = money(invoice.total_amount - invoice.amount_paid)
    invoice.status = "PAID" if invoice.amount_due == 0 else "PARTIALLY_PAID"
    credit = CreditNote(
        invoice_id=invoice.id, customer_id=invoice.customer_id, credit_note_number=f"CN-{uuid4().hex[:10].upper()}",
        reason=payload.reason, amount=amount, currency=invoice.currency, status="ISSUED", issued_at=utcnow(),
    )
    db.add(credit)
    await db.flush()
    audit(db, order_id=invoice.order_id, invoice_id=invoice.id, payment_id=payment.id, action="PAYMENT_REFUNDED", performed_by=performed_by, new=str(amount), reason=payload.reason)
    audit(db, order_id=invoice.order_id, invoice_id=invoice.id, action="CREDIT_NOTE_CREATED", performed_by=performed_by, new=credit.credit_note_number)
    await db.commit()
    return payment


async def create_subscription(db: AsyncSession, order_item_id: str, performed_by: str) -> Subscription:
    result = await db.execute(select(OrderItem).options(selectinload(OrderItem.order), selectinload(OrderItem.plan)).where(OrderItem.id == order_item_id))
    item = result.scalar_one_or_none()
    if not item or item.billing_type != "RECURRING" or not item.plan:
        raise HTTPException(400, "A recurring order item with an active plan is required")
    existing = await db.execute(select(Subscription).where(Subscription.order_item_id == item.id))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Subscription already exists")
    start = item.billing_start_date or date.today()
    end = add_interval(start, item.plan.interval)
    subscription = Subscription(order_id=item.order_id, customer_id=item.order.customer_id, order_item_id=item.id, subscription_plan_id=item.plan.id, status="ACTIVE", quantity=item.quantity, unit_price=item.plan.price, current_period_start=start, current_period_end=end, next_billing_date=end)
    db.add(subscription)
    await db.flush()
    db.add(BillingSchedule(subscription_id=subscription.id, billing_date=start, period_start=start, period_end=end, amount=money(item.quantity * item.plan.price), status="PENDING"))
    audit(db, order_id=item.order_id, subscription_id=subscription.id, action="SUBSCRIPTION_CREATED", performed_by=performed_by)
    await db.commit()
    await db.refresh(subscription)
    return subscription


async def modify_subscription(db: AsyncSession, subscription_id: str, payload, performed_by: str) -> tuple[Subscription, Decimal]:
    result = await db.execute(select(Subscription).options(selectinload(Subscription.plan)).where(Subscription.id == subscription_id).with_for_update())
    subscription = result.scalar_one_or_none()
    if not subscription or subscription.status != "ACTIVE":
        raise HTTPException(400, "Only active subscriptions can be modified")
    today = date.today()
    total_days = max((subscription.current_period_end - subscription.current_period_start).days, 1)
    remaining_days = max((subscription.current_period_end - today).days, 0)
    old_quantity, old_price = subscription.quantity, subscription.unit_price
    if payload.quantity is not None:
        subscription.quantity = payload.quantity
    if payload.subscription_plan_id:
        plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.subscription_plan_id, SubscriptionPlan.active.is_(True)))
        subscription.plan = plan_result.scalar_one_or_none()
        if not subscription.plan:
            raise HTTPException(404, "Subscription plan not found")
        subscription.subscription_plan_id = subscription.plan.id
        subscription.unit_price = subscription.plan.price
    delta = calculate_proration(old_quantity, old_price, subscription.quantity, subscription.unit_price, remaining_days, total_days)
    audit(db, order_id=subscription.order_id, subscription_id=subscription.id, action="SUBSCRIPTION_MODIFIED", performed_by=performed_by, old=f"quantity={old_quantity},price={old_price}", new=f"quantity={subscription.quantity},price={subscription.unit_price}")
    if delta != 0:
        audit(db, order_id=subscription.order_id, subscription_id=subscription.id, action="PRORATION_CREATED", performed_by=performed_by, new=str(delta))
    await db.commit()
    return subscription, delta


async def generate_recurring_invoice(db: AsyncSession, subscription_id: str, performed_by: str) -> Invoice:
    result = await db.execute(select(BillingSchedule).options(selectinload(BillingSchedule.subscription).selectinload(Subscription.plan)).where(BillingSchedule.subscription_id == subscription_id, BillingSchedule.status == "PENDING").order_by(BillingSchedule.billing_date).limit(1).with_for_update())
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(400, "No pending billing schedule")
    subscription = schedule.subscription
    invoice = Invoice(order_id=subscription.order_id, customer_id=subscription.customer_id, invoice_number=f"INV-{uuid4().hex[:10].upper()}", invoice_type="RECURRING", status="ISSUED", currency=subscription.plan.currency if subscription.plan else "INR", subtotal=schedule.amount, discount_amount=0, tax_amount=0, total_amount=schedule.amount, amount_paid=0, amount_due=schedule.amount, due_date=schedule.billing_date + timedelta(days=30), issued_at=utcnow())
    invoice.items.append(InvoiceItem(subscription_id=subscription.id, description="Subscription billing", quantity=subscription.quantity, unit_price=subscription.unit_price, discount_amount=0, tax_amount=0, total_amount=schedule.amount, billing_period_start=schedule.period_start, billing_period_end=schedule.period_end))
    db.add(invoice)
    schedule.status = "INVOICED"
    await db.flush()
    schedule.invoice_id = invoice.id
    subscription.current_period_start = schedule.period_start
    subscription.current_period_end = schedule.period_end
    subscription.next_billing_date = add_interval(schedule.period_end, subscription.plan.interval)
    db.add(BillingSchedule(subscription_id=subscription.id, billing_date=schedule.period_end, period_start=schedule.period_end, period_end=subscription.next_billing_date, amount=money(subscription.quantity * subscription.unit_price), status="PENDING"))
    audit(db, order_id=subscription.order_id, invoice_id=invoice.id, subscription_id=subscription.id, action="INVOICE_CREATED", performed_by=performed_by, new=invoice.invoice_number)
    await db.commit()
    await db.refresh(invoice)
    return invoice

async def create_order_from_quote(
    db: AsyncSession,
    quote_id: str,
    performed_by: str,
) -> Order:
    result = await db.execute(
        select(Quotation)
        .options(selectinload(Quotation.lines))
        .where(Quotation.id == quote_id)
        .with_for_update()
    )
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(404, "Quotation not found")

    if quote.status != QuoteStatus.CONFIRMED:
        raise HTTPException(
            409,
            "Only confirmed quotations can be converted into orders",
        )

    if not quote.lines:
        raise HTTPException(
            400,
            "Quotation must contain at least one line",
        )

    existing_result = await db.execute(
        select(Order).where(Order.quotation_id == quote.id)
    )
    existing_order = existing_result.scalar_one_or_none()

    if existing_order:
        return existing_order

    order = Order(
        customer_id=quote.customer_id,
        quotation_id=quote.id,
        order_number=f"ORD-{uuid4().hex[:10].upper()}",
        status="CONFIRMED",
        currency=quote.currency.upper(),
        subtotal=money(quote.subtotal),
        discount_amount=money(quote.discount_total),
        tax_amount=money(quote.tax_total),
        total_amount=money(quote.grand_total),
        confirmed_at=utcnow(),
    )

    db.add(order)
    await db.flush()

    subtotal = Decimal("0.00")
    discount = Decimal("0.00")
    tax = Decimal("0.00")

    for line in quote.lines:
        order_item = OrderItem(
            order_id=order.id,
            product_id=line.product_id,
            product_name_snapshot=line.description_snapshot,
            quantity=line.quantity,
            unit_price=line.unit_price,
            discount_percent=line.discount_percent,
            discount_amount=line.discount_amount,
            tax_amount=money(
                line.line_total
                - (line.line_subtotal - line.discount_amount)
            ),
            total_amount=line.line_total,
            billing_type="ONE_TIME",
        )

        order.items.append(order_item)

        subtotal += line.line_subtotal
        discount += line.discount_amount
        tax += money(
            line.line_total
            - (line.line_subtotal - line.discount_amount)
        )

    order.subtotal = money(subtotal)
    order.discount_amount = money(discount)
    order.tax_amount = money(tax)
    order.total_amount = money(subtotal - discount + tax)

    await db.flush()

    audit(
        db,
        order_id=order.id,
        action="ORDER_CREATED_FROM_QUOTE",
        performed_by=performed_by,
        new=f"quotation={quote.quote_number}",
    )

    return order