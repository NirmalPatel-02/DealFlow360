from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


money = Numeric(14, 2)


class Order(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "orders"

    customer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    quotation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    order_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="CONFIRMED", index=True)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    subtotal: Mapped[Decimal] = mapped_column(money, default=0)
    discount_amount: Mapped[Decimal] = mapped_column(money, default=0)
    tax_amount: Mapped[Decimal] = mapped_column(money, default=0)
    total_amount: Mapped[Decimal] = mapped_column(money, default=0)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="order")
    payments: Mapped[list["Payment"]] = relationship(back_populates="order")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="order")


class OrderItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "order_items"

    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    product_name_snapshot: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    unit_price: Mapped[Decimal] = mapped_column(money)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 3), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(money, default=0)
    tax_amount: Mapped[Decimal] = mapped_column(money, default=0)
    total_amount: Mapped[Decimal] = mapped_column(money, default=0)
    billing_type: Mapped[str] = mapped_column(Enum("ONE_TIME", "RECURRING", name="billing_type"))
    subscription_plan_id: Mapped[str | None] = mapped_column(ForeignKey("subscription_plans.id"), nullable=True)
    recurring_unit: Mapped[str | None] = mapped_column(String(10), nullable=True)
    recurring_interval: Mapped[int | None] = mapped_column(nullable=True)
    billing_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    billing_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    order: Mapped[Order] = relationship(back_populates="items")
    plan: Mapped["SubscriptionPlan | None"] = relationship()


class SubscriptionPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(String(120))
    interval: Mapped[str] = mapped_column(Enum("MONTHLY", "QUARTERLY", "YEARLY", name="plan_interval"))
    price: Mapped[Decimal] = mapped_column(money)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    proration_enabled: Mapped[bool] = mapped_column(default=True)
    cancellation_policy: Mapped[str] = mapped_column(String(30), default="IMMEDIATE")
    refund_policy: Mapped[str] = mapped_column(String(30), default="NONE")
    active: Mapped[bool] = mapped_column(default=True, index=True)


class Subscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    order_item_id: Mapped[str] = mapped_column(ForeignKey("order_items.id"), unique=True)
    subscription_plan_id: Mapped[str] = mapped_column(ForeignKey("subscription_plans.id"))
    status: Mapped[str] = mapped_column(Enum("ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", name="subscription_status"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    unit_price: Mapped[Decimal] = mapped_column(money)
    current_period_start: Mapped[date] = mapped_column(Date)
    current_period_end: Mapped[date] = mapped_column(Date)
    next_billing_date: Mapped[date] = mapped_column(Date, index=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    order: Mapped[Order] = relationship(back_populates="subscriptions")
    plan: Mapped[SubscriptionPlan] = relationship()
    schedules: Mapped[list["BillingSchedule"]] = relationship(back_populates="subscription", cascade="all, delete-orphan")


class Invoice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "invoices"

    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    invoice_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    invoice_type: Mapped[str] = mapped_column(Enum("ONE_TIME", "RECURRING", name="invoice_type"), index=True)
    status: Mapped[str] = mapped_column(Enum("DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CANCELLED", name="invoice_status"), index=True)
    currency: Mapped[str] = mapped_column(String(3))
    subtotal: Mapped[Decimal] = mapped_column(money, default=0)
    discount_amount: Mapped[Decimal] = mapped_column(money, default=0)
    tax_amount: Mapped[Decimal] = mapped_column(money, default=0)
    total_amount: Mapped[Decimal] = mapped_column(money, default=0)
    amount_paid: Mapped[Decimal] = mapped_column(money, default=0)
    amount_due: Mapped[Decimal] = mapped_column(money, default=0)
    due_date: Mapped[date] = mapped_column(Date)
    issued_at: Mapped[datetime] = mapped_column(DateTime)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    order: Mapped[Order] = relationship(back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="invoice")


class InvoiceItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    order_item_id: Mapped[str | None] = mapped_column(ForeignKey("order_items.id"), nullable=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id"), nullable=True)
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    unit_price: Mapped[Decimal] = mapped_column(money)
    discount_amount: Mapped[Decimal] = mapped_column(money, default=0)
    tax_amount: Mapped[Decimal] = mapped_column(money, default=0)
    total_amount: Mapped[Decimal] = mapped_column(money)
    billing_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    billing_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    invoice: Mapped[Invoice] = relationship(back_populates="items")


class Payment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (Index("ix_payment_invoice_status", "invoice_id", "status"),)

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), index=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    payment_reference: Mapped[str] = mapped_column(String(100), unique=True)
    amount: Mapped[Decimal] = mapped_column(money)
    refunded_amount: Mapped[Decimal] = mapped_column(money, default=0)
    currency: Mapped[str] = mapped_column(String(3))
    payment_method: Mapped[str] = mapped_column(Enum("CASH", "BANK_TRANSFER", "CARD", "UPI", "OTHER", name="payment_method"))
    status: Mapped[str] = mapped_column(Enum("PENDING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", name="payment_status"), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
    order: Mapped[Order] = relationship(back_populates="payments")


class CreditNote(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "credit_notes"

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), index=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id"), nullable=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    credit_note_number: Mapped[str] = mapped_column(String(40), unique=True)
    reason: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(money)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(Enum("DRAFT", "ISSUED", "APPLIED", "CANCELLED", name="credit_note_status"))
    issued_at: Mapped[datetime] = mapped_column(DateTime)


class BillingSchedule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "billing_schedules"

    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id", ondelete="CASCADE"), index=True)
    billing_date: Mapped[date] = mapped_column(Date, index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(money)
    status: Mapped[str] = mapped_column(Enum("PENDING", "INVOICED", "PAID", "SKIPPED", "CANCELLED", name="schedule_status"), index=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)

    subscription: Mapped[Subscription] = relationship(back_populates="schedules")


class BillingAuditLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "billing_audit_logs"

    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    payment_id: Mapped[str | None] = mapped_column(ForeignKey("payments.id"), nullable=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("subscriptions.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)