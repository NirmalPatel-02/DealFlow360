from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PortalShareResponse(BaseModel):
    portal_url: str
    expires_at: datetime


class PortalAccessRequest(BaseModel):
    token: str = Field(min_length=20, max_length=500)


class PortalAccessResponse(BaseModel):
    session_token: str
    quotation_id: str
    expires_at: datetime


class PortalQuoteLineResponse(BaseModel):
    id: str
    line_number: int
    product_name: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_percent: Decimal
    line_total: Decimal


class PortalQuoteResponse(BaseModel):
    id: str
    quote_number: str
    status: str
    currency: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    grand_total: Decimal
    valid_until: datetime | None
    lines: list[PortalQuoteLineResponse]


class NegotiationRequestCreate(BaseModel):
    quote_line_id: str | None = None

    message: str = Field(
        min_length=2,
        max_length=5000,
    )

    requested_discount_percent: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    requested_quantity: Decimal | None = Field(
        default=None,
        gt=0,
        le=1_000_000,
    )


class NegotiationRequestResponse(BaseModel):
    id: str
    quotation_id: str
    quote_line_id: str | None
    message: str
    requested_discount_percent: Decimal | None
    requested_quantity: Decimal | None
    status: str
    created_at: datetime
    resolution_note: str | None


class NegotiationResolveRequest(BaseModel):
    action: str = Field(
        pattern="^(accept|reject)$"
    )

    resolution_note: str | None = Field(
        default=None,
        max_length=5000,
    )