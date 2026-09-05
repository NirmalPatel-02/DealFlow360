from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import QuoteLineType, QuoteStatus


class QuotationCreate(BaseModel):
    customer_id: str
    notes: str | None = Field(default=None, max_length=5000)
    valid_until: datetime | None = None


class QuotationUpdate(BaseModel):
    notes: str | None = Field(default=None, max_length=5000)
    valid_until: datetime | None = None


class QuoteLineCreate(BaseModel):
    product_id: str
    variant_id: str | None = None
    quantity: Decimal = Field(gt=0, le=1_000_000)
    discount_percent: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        le=100,
    )
    line_type: QuoteLineType = QuoteLineType.ONE_TIME
    notes: str | None = Field(default=None, max_length=2000)


class QuoteLineUpdate(BaseModel):
    quantity: Decimal | None = Field(
        default=None,
        gt=0,
        le=1_000_000,
    )
    discount_percent: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )
    notes: str | None = Field(default=None, max_length=2000)


class QuoteLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quotation_id: str
    line_number: int
    product_id: str
    variant_id: str | None
    line_type: QuoteLineType
    description_snapshot: str
    quantity: Decimal
    unit_price: Decimal
    unit_cost: Decimal
    discount_percent: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    line_subtotal: Decimal
    line_total: Decimal
    line_cost: Decimal
    margin_amount: Decimal
    notes: str | None


class QuotationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quote_number: str
    customer_id: str
    created_by_user_id: str
    status: QuoteStatus
    currency: str
    customer_tier_snapshot: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    grand_total: Decimal
    total_cost: Decimal
    gross_margin: Decimal
    gross_margin_percent: Decimal
    risk_score: Decimal
    notes: str | None
    valid_until: datetime | None
    created_at: datetime
    updated_at: datetime
    lines: list[QuoteLineResponse]


class QuoteSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quote_number: str
    customer_id: str
    status: QuoteStatus
    currency: str
    grand_total: Decimal
    gross_margin_percent: Decimal
    risk_score: Decimal
    created_at: datetime