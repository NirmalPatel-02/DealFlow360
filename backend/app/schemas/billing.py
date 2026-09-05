from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BillingModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class OrderItemCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    product_id: str | None = None
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    billing_type: str = "ONE_TIME"
    discount_percent: Decimal = Field(default=0, ge=0, le=100)
    tax_percent: Decimal = Field(default=0, ge=0, le=100)
    subscription_plan_id: str | None = None


class OrderCreate(BaseModel):
    customer_id: str
    currency: str = Field(default="INR", min_length=3, max_length=3)
    status: str = "CONFIRMED"
    items: list[OrderItemCreate] = Field(min_length=1)


class PlanCreate(BaseModel):
    name: str
    interval: str
    price: Decimal = Field(gt=0)
    currency: str = "INR"
    proration_enabled: bool = True
    cancellation_policy: str = "IMMEDIATE"
    refund_policy: str = "NONE"


class InvoiceCreate(BaseModel):
    order_id: str


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_method: str
    payment_reference: str = Field(min_length=1, max_length=100)


class RefundCreate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    reason: str = "Payment refund"


class SubscriptionCreate(BaseModel):
    order_item_id: str


class SubscriptionModify(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=0)
    subscription_plan_id: str | None = None


class CancellationRequest(BaseModel):
    reason: str = "Customer requested cancellation"


class OrderResponse(BillingModel):
    id: str
    order_number: str
    status: str
    currency: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal


class InvoiceResponse(BillingModel):
    id: str
    invoice_number: str
    invoice_type: str
    status: str
    currency: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    due_date: date
    issued_at: datetime


class SubscriptionResponse(BillingModel):
    id: str
    order_id: str
    customer_id: str
    status: str
    quantity: Decimal
    unit_price: Decimal
    current_period_start: date
    current_period_end: date
    next_billing_date: date
