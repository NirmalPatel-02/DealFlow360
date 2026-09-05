from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.auth import get_current_user
from app.db.session import get_db
from app.models.billing import BillingAuditLog, BillingSchedule, Invoice, Order, Payment, Subscription, SubscriptionPlan
from app.models.user import User
from app.schemas.billing import (
    CancellationRequest, InvoiceCreate, OrderCreate, PaymentCreate, PlanCreate,
    RefundCreate, SubscriptionCreate, SubscriptionModify,
)
from app.services.billing import (
    create_invoice, create_order, create_order_from_quote, create_subscription, modify_subscription,
    generate_recurring_invoice, record_payment, refund_payment,
)

router = APIRouter(tags=["Billing"])


def ensure_billing_role(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"finance", "finance_ops", "admin", "sales", "sales_rep", "sales_manager"}:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Billing access is restricted")
    return user


def success(data, message: str):
    return {"success": True, "data": data, "message": message}


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order_endpoint(payload: OrderCreate, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    order = await create_order(db, payload, user.id)
    await db.commit()
    return success({"id": order.id, "orderNumber": order.order_number, "totalAmount": order.total_amount}, "Order created successfully")


@router.post("/orders/from-quote/{quote_id}", status_code=status.HTTP_201_CREATED)
async def create_order_from_quote_endpoint(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(ensure_billing_role),
):
    order = await create_order_from_quote(db, quote_id, user.id)
    await db.commit()
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order.id)
    )
    loaded_order = result.scalar_one()
    return success(
        {
            "id": loaded_order.id,
            "orderNumber": loaded_order.order_number,
            "quotationId": loaded_order.quotation_id,
            "status": loaded_order.status,
            "currency": loaded_order.currency,
            "totalAmount": loaded_order.total_amount,
            "itemsCount": len(loaded_order.items),
        },
        "Order created from quotation successfully",
    )


@router.get("/orders")
async def list_orders(
    customerId: str | None = None,
    quotationId: str | None = None,
    order_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(ensure_billing_role),
):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    if customerId:
        query = query.where(Order.customer_id == customerId)
    if quotationId:
        query = query.where(Order.quotation_id == quotationId)
    if order_status:
        query = query.where(Order.status == order_status)
    result = await db.execute(query)
    orders = result.scalars().all()
    return success(orders, "Orders retrieved successfully")


@router.get("/orders/{order_id}")
async def get_order_endpoint(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(ensure_billing_role),
):
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.invoices),
            selectinload(Order.subscriptions),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        from fastapi import HTTPException
        raise HTTPException(404, "Order not found")
    return success(order, "Order retrieved successfully")


@router.get("/orders/by-quote/{quote_id}")
async def get_order_by_quote(
    quote_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(ensure_billing_role),
):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.invoices))
        .where(Order.quotation_id == quote_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        from fastapi import HTTPException
        raise HTTPException(404, "No order found for this quotation")
    return success(order, "Order retrieved successfully")


@router.get("/subscription-plans")
async def list_subscription_plans(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(ensure_billing_role),
):
    result = await db.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.active == True)
        .order_by(SubscriptionPlan.name)
    )
    return success(result.scalars().all(), "Subscription plans retrieved successfully")


@router.get("/subscriptions")
async def list_subscriptions(
    customerId: str | None = None,
    orderId: str | None = None,
    sub_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(ensure_billing_role),
):
    query = (
        select(Subscription)
        .options(
            selectinload(Subscription.plan),
            selectinload(Subscription.schedules),
        )
        .order_by(Subscription.created_at.desc())
    )
    if customerId:
        query = query.where(Subscription.customer_id == customerId)
    if orderId:
        query = query.where(Subscription.order_id == orderId)
    if sub_status:
        query = query.where(Subscription.status == sub_status)
    result = await db.execute(query)
    return success(result.scalars().all(), "Subscriptions retrieved successfully")


@router.post("/subscription-plans", status_code=status.HTTP_201_CREATED)
async def create_plan(payload: PlanCreate, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    if payload.interval not in {"MONTHLY", "QUARTERLY", "YEARLY"}:
        from fastapi import HTTPException
        raise HTTPException(400, "Invalid subscription interval")
    plan = SubscriptionPlan(**payload.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return success({"id": plan.id, "name": plan.name, "interval": plan.interval, "price": plan.price}, "Subscription plan created successfully")


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def create_invoice_endpoint(payload: InvoiceCreate, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    invoice = await create_invoice(db, payload.order_id, user.id)
    return success(invoice, "Invoice created successfully")


@router.get("/invoices")
async def list_invoices(customerId: str | None = None, orderId: str | None = None, invoice_status: str | None = Query(default=None, alias="status"), invoiceType: str | None = None, from_date: date | None = Query(default=None, alias="fromDate"), to_date: date | None = Query(default=None, alias="toDate"), db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    query = select(Invoice).order_by(Invoice.created_at.desc())
    if customerId:
        query = query.where(Invoice.customer_id == customerId)
    if orderId:
        query = query.where(Invoice.order_id == orderId)
    if invoice_status:
        query = query.where(Invoice.status == invoice_status)
    if invoiceType:
        query = query.where(Invoice.invoice_type == invoiceType)
    if from_date:
        query = query.where(Invoice.created_at >= from_date)
    if to_date:
        query = query.where(Invoice.created_at < to_date)
    result = await db.execute(query)
    return success(result.scalars().all(), "Invoices retrieved successfully")


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    result = await db.execute(select(Invoice).options(selectinload(Invoice.items), selectinload(Invoice.payments)).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        from fastapi import HTTPException
        raise HTTPException(404, "Invoice not found")
    return success(invoice, "Invoice retrieved successfully")


@router.post("/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
async def add_payment(invoice_id: str, payload: PaymentCreate, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    payment = await record_payment(db, invoice_id, payload, user.id)
    return success(payment, "Payment recorded successfully")


@router.post("/invoices/{invoice_id}/cancel")
async def cancel_invoice(invoice_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id).with_for_update())
    invoice = result.scalar_one_or_none()
    if not invoice or invoice.status in {"PAID", "CANCELLED", "VOID"}:
        from fastapi import HTTPException
        raise HTTPException(400, "Invoice cannot be cancelled")
    invoice.status = "CANCELLED"
    from app.services.billing import audit
    audit(db, order_id=invoice.order_id, invoice_id=invoice.id, action="INVOICE_CANCELLED", performed_by=user.id)
    await db.commit()
    return success(invoice, "Invoice cancelled successfully")


@router.get("/invoices/{invoice_id}/payments")
async def get_payments(invoice_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    result = await db.execute(select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.created_at.desc()))
    return success(result.scalars().all(), "Payment history retrieved successfully")


@router.post("/payments/{payment_id}/refund")
async def refund(payment_id: str, payload: RefundCreate, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    payment = await refund_payment(db, payment_id, payload, user.id)
    return success(payment, "Payment refunded successfully")


@router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
async def add_subscription(payload: SubscriptionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    subscription = await create_subscription(db, payload.order_item_id, user.id)
    return success(subscription, "Subscription created successfully")


@router.get("/subscriptions/{subscription_id}")
async def get_subscription(subscription_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    result = await db.execute(select(Subscription).options(selectinload(Subscription.schedules), selectinload(Subscription.plan)).where(Subscription.id == subscription_id))
    subscription = result.scalar_one_or_none()
    if not subscription:
        from fastapi import HTTPException
        raise HTTPException(404, "Subscription not found")
    return success(subscription, "Subscription retrieved successfully")


@router.patch("/subscriptions/{subscription_id}")
async def modify(subscription_id: str, payload: SubscriptionModify, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    subscription, proration = await modify_subscription(db, subscription_id, payload, user.id)
    return success({"subscription": subscription, "proratedAmount": proration}, "Subscription modified successfully")


@router.post("/subscriptions/{subscription_id}/cancel")
async def cancel(subscription_id: str, payload: CancellationRequest, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    result = await db.execute(select(Subscription).where(Subscription.id == subscription_id).with_for_update())
    subscription = result.scalar_one_or_none()
    if not subscription or subscription.status != "ACTIVE":
        from fastapi import HTTPException
        raise HTTPException(400, "Only active subscriptions can be cancelled")
    subscription.status = "CANCELLED"
    subscription.cancelled_at = __import__("app.utils.time", fromlist=["utcnow"]).utcnow()
    await db.execute(__import__("sqlalchemy", fromlist=["update"]).update(BillingSchedule).where(BillingSchedule.subscription_id == subscription.id, BillingSchedule.status == "PENDING").values(status="CANCELLED"))
    from app.services.billing import audit
    audit(db, order_id=subscription.order_id, subscription_id=subscription.id, action="SUBSCRIPTION_CANCELLED", performed_by=user.id, reason=payload.reason)
    await db.commit()
    return success(subscription, "Subscription cancelled successfully")


@router.get("/subscriptions/{subscription_id}/billing-schedule")
async def billing_schedule(subscription_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    result = await db.execute(select(BillingSchedule).where(BillingSchedule.subscription_id == subscription_id).order_by(BillingSchedule.billing_date))
    return success(result.scalars().all(), "Billing schedule retrieved successfully")


@router.post("/subscriptions/{subscription_id}/generate-invoice", status_code=status.HTTP_201_CREATED)
async def generate_invoice(subscription_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    invoice = await generate_recurring_invoice(db, subscription_id, user.id)
    return success(invoice, "Recurring invoice generated successfully")


@router.get("/orders/{order_id}/billing")
async def billing_summary(order_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(ensure_billing_role)):
    order_result = await db.execute(select(Order).where(Order.id == order_id))
    if not order_result.scalar_one_or_none():
        from fastapi import HTTPException
        raise HTTPException(404, "Order not found")
    invoice_result = await db.execute(select(Invoice).where(Invoice.order_id == order_id))
    invoices = invoice_result.scalars().all()
    subscription_result = await db.execute(select(Subscription).where(Subscription.order_id == order_id, Subscription.status == "ACTIVE"))
    subscriptions = subscription_result.scalars().all()
    schedule_result = await db.execute(select(BillingSchedule).where(BillingSchedule.subscription_id.in_([item.id for item in subscriptions]), BillingSchedule.status == "PENDING").order_by(BillingSchedule.billing_date)) if subscriptions else None
    schedules = schedule_result.scalars().all() if schedule_result else []
    one_time = [item for item in invoices if item.invoice_type == "ONE_TIME"]
    return success({"orderId": order_id, "oneTime": {"invoiceTotal": sum((item.total_amount for item in one_time), 0), "paid": sum((item.amount_paid for item in one_time), 0), "due": sum((item.amount_due for item in one_time), 0)}, "recurring": {"activeSubscriptions": len(subscriptions), "nextBillingDate": schedules[0].billing_date if schedules else None, "nextBillingAmount": schedules[0].amount if schedules else 0}, "totalPaid": sum((item.amount_paid for item in invoices), 0), "totalDue": sum((item.amount_due for item in invoices), 0)}, "Billing summary retrieved successfully")