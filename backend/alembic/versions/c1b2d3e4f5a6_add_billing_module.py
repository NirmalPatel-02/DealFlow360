"""add billing and payment module

Revision ID: c1b2d3e4f5a6
Revises: fbae9fd50dd7
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c1b2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "fbae9fd50dd7"
branch_labels = None
depends_on = None

money = sa.Numeric(14, 2)


def upgrade() -> None:
    op.create_table("subscription_plans",
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("interval", sa.Enum("MONTHLY", "QUARTERLY", "YEARLY", name="plan_interval"), nullable=False),
        sa.Column("price", money, nullable=False), sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("proration_enabled", sa.Boolean(), nullable=False), sa.Column("cancellation_policy", sa.String(30), nullable=False),
        sa.Column("refund_policy", sa.String(30), nullable=False), sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_subscription_plans_active", "subscription_plans", ["active"])
    op.create_table("orders",
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("quotation_id", sa.String(36)),
        sa.Column("order_number", sa.String(40), nullable=False, unique=True), sa.Column("status", sa.String(20), nullable=False), sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("subtotal", money, nullable=False), sa.Column("discount_amount", money, nullable=False), sa.Column("tax_amount", money, nullable=False), sa.Column("total_amount", money, nullable=False),
        sa.Column("confirmed_at", sa.DateTime()), sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_orders_customer_id", "orders", ["customer_id"]); op.create_index("ix_orders_order_number", "orders", ["order_number"], unique=True); op.create_index("ix_orders_status", "orders", ["status"])
    op.create_table("order_items",
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False), sa.Column("product_id", sa.String(36)), sa.Column("product_name_snapshot", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False), sa.Column("unit_price", money, nullable=False), sa.Column("discount_percent", sa.Numeric(6, 3), nullable=False), sa.Column("discount_amount", money, nullable=False), sa.Column("tax_amount", money, nullable=False), sa.Column("total_amount", money, nullable=False),
        sa.Column("billing_type", sa.Enum("ONE_TIME", "RECURRING", name="billing_type"), nullable=False), sa.Column("subscription_plan_id", sa.String(36), sa.ForeignKey("subscription_plans.id")), sa.Column("recurring_unit", sa.String(10)), sa.Column("recurring_interval", sa.Integer()), sa.Column("billing_start_date", sa.Date()), sa.Column("billing_end_date", sa.Date()),
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_table("subscriptions",
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id"), nullable=False), sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("order_item_id", sa.String(36), sa.ForeignKey("order_items.id"), nullable=False, unique=True), sa.Column("subscription_plan_id", sa.String(36), sa.ForeignKey("subscription_plans.id"), nullable=False),
        sa.Column("status", sa.Enum("ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", name="subscription_status"), nullable=False), sa.Column("quantity", sa.Numeric(14, 3), nullable=False), sa.Column("unit_price", money, nullable=False), sa.Column("current_period_start", sa.Date(), nullable=False), sa.Column("current_period_end", sa.Date(), nullable=False), sa.Column("next_billing_date", sa.Date(), nullable=False), sa.Column("cancelled_at", sa.DateTime()),
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, column in [("ix_subscriptions_order_id", "order_id"), ("ix_subscriptions_customer_id", "customer_id"), ("ix_subscriptions_status", "status"), ("ix_subscriptions_next_billing_date", "next_billing_date")]: op.create_index(name, "subscriptions", [column])
    op.create_table("invoices",
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id"), nullable=False), sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("invoice_number", sa.String(40), nullable=False, unique=True), sa.Column("invoice_type", sa.Enum("ONE_TIME", "RECURRING", name="invoice_type"), nullable=False), sa.Column("status", sa.Enum("DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CANCELLED", name="invoice_status"), nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("subtotal", money, nullable=False), sa.Column("discount_amount", money, nullable=False), sa.Column("tax_amount", money, nullable=False), sa.Column("total_amount", money, nullable=False), sa.Column("amount_paid", money, nullable=False), sa.Column("amount_due", money, nullable=False), sa.Column("due_date", sa.Date(), nullable=False), sa.Column("issued_at", sa.DateTime(), nullable=False), sa.Column("paid_at", sa.DateTime()), sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, column in [("ix_invoices_order_id", "order_id"), ("ix_invoices_customer_id", "customer_id"), ("ix_invoices_invoice_number", "invoice_number"), ("ix_invoices_invoice_type", "invoice_type"), ("ix_invoices_status", "status")]: op.create_index(name, "invoices", [column], unique=column == "invoice_number")
    op.create_table("invoice_items",
        sa.Column("invoice_id", sa.String(36), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False), sa.Column("order_item_id", sa.String(36), sa.ForeignKey("order_items.id")), sa.Column("subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id")), sa.Column("description", sa.String(255), nullable=False), sa.Column("quantity", sa.Numeric(14, 3), nullable=False), sa.Column("unit_price", money, nullable=False), sa.Column("discount_amount", money, nullable=False), sa.Column("tax_amount", money, nullable=False), sa.Column("total_amount", money, nullable=False), sa.Column("billing_period_start", sa.Date()), sa.Column("billing_period_end", sa.Date()), sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_invoice_items_invoice_id", "invoice_items", ["invoice_id"])
    op.create_table("payments",
        sa.Column("invoice_id", sa.String(36), sa.ForeignKey("invoices.id"), nullable=False), sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id"), nullable=False), sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("payment_reference", sa.String(100), nullable=False, unique=True), sa.Column("amount", money, nullable=False), sa.Column("refunded_amount", money, nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("payment_method", sa.Enum("CASH", "BANK_TRANSFER", "CARD", "UPI", "OTHER", name="payment_method"), nullable=False), sa.Column("status", sa.Enum("PENDING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", name="payment_status"), nullable=False), sa.Column("paid_at", sa.DateTime()), sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, column in [("ix_payments_invoice_id", "invoice_id"), ("ix_payments_order_id", "order_id"), ("ix_payments_customer_id", "customer_id"), ("ix_payments_payment_reference", "payment_reference"), ("ix_payments_status", "status")]: op.create_index(name, "payments", [column], unique=column == "payment_reference")
    op.create_table("billing_schedules", sa.Column("subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False), sa.Column("billing_date", sa.Date(), nullable=False), sa.Column("period_start", sa.Date(), nullable=False), sa.Column("period_end", sa.Date(), nullable=False), sa.Column("amount", money, nullable=False), sa.Column("status", sa.Enum("PENDING", "INVOICED", "PAID", "SKIPPED", "CANCELLED", name="schedule_status"), nullable=False), sa.Column("invoice_id", sa.String(36), sa.ForeignKey("invoices.id")), sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    for name, column in [("ix_billing_schedules_subscription_id", "subscription_id"), ("ix_billing_schedules_billing_date", "billing_date"), ("ix_billing_schedules_status", "status")]: op.create_index(name, "billing_schedules", [column])
    op.create_table("credit_notes", sa.Column("invoice_id", sa.String(36), sa.ForeignKey("invoices.id"), nullable=False), sa.Column("subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id")), sa.Column("customer_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("credit_note_number", sa.String(40), nullable=False, unique=True), sa.Column("reason", sa.String(255), nullable=False), sa.Column("amount", money, nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("status", sa.Enum("DRAFT", "ISSUED", "APPLIED", "CANCELLED", name="credit_note_status"), nullable=False), sa.Column("issued_at", sa.DateTime(), nullable=False), sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    op.create_table("billing_audit_logs", sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id"), nullable=False), sa.Column("invoice_id", sa.String(36), sa.ForeignKey("invoices.id")), sa.Column("payment_id", sa.String(36), sa.ForeignKey("payments.id")), sa.Column("subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id")), sa.Column("action", sa.String(40), nullable=False), sa.Column("old_value", sa.Text()), sa.Column("new_value", sa.Text()), sa.Column("performed_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("reason", sa.String(255)), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("id", sa.String(36), primary_key=True))
    op.create_index("ix_billing_audit_logs_order_id", "billing_audit_logs", ["order_id"]); op.create_index("ix_billing_audit_logs_action", "billing_audit_logs", ["action"])


def downgrade() -> None:
    for table in ("billing_audit_logs", "credit_notes", "billing_schedules", "payments", "invoice_items", "invoices", "subscriptions", "order_items", "orders", "subscription_plans"): op.drop_table(table)