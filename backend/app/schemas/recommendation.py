from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RecommendationRuleCreate(BaseModel):
    source_product_id: str
    suggested_product_id: str
    co_purchase_count: int = Field(default=0, ge=0)
    recommendation_weight: Decimal = Field(
        default=Decimal("1.00"),
        ge=0,
        le=1000,
    )
    minimum_margin_percent: Decimal = Field(
        default=Decimal("10.00"),
        ge=0,
        le=100,
    )

    @model_validator(mode="after")
    def validate_products(self):
        if self.source_product_id == self.suggested_product_id:
            raise ValueError(
                "Source and suggested product cannot be the same."
            )
        return self


class RecommendationRuleUpdate(BaseModel):
    co_purchase_count: int | None = Field(
        default=None,
        ge=0,
    )
    recommendation_weight: Decimal | None = Field(
        default=None,
        ge=0,
        le=1000,
    )
    minimum_margin_percent: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )
    is_active: bool | None = None


class RecommendationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_product_id: str
    suggested_product_id: str
    co_purchase_count: int
    recommendation_weight: Decimal
    minimum_margin_percent: Decimal
    is_active: bool


class PromotionCreate(BaseModel):
    product_id: str
    name: str = Field(min_length=2, max_length=150)
    ranking_boost: Decimal = Field(
        default=Decimal("10.00"),
        ge=0,
        le=1000,
    )
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_dates(self):
        if self.ends_at <= self.starts_at:
            raise ValueError(
                "ends_at must be later than starts_at."
            )
        return self


class PromotionUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )
    ranking_boost: Decimal | None = Field(
        default=None,
        ge=0,
        le=1000,
    )
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool | None = None


class PromotionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    name: str
    ranking_boost: Decimal
    starts_at: datetime
    ends_at: datetime
    is_active: bool


class RecommendationResponse(BaseModel):
    product_id: str
    product_name: str
    product_code: str
    product_type: str

    recommended_unit_price: Decimal
    recommended_unit_cost: Decimal

    margin_amount: Decimal
    margin_percent: Decimal
    margin_delta_amount: Decimal
    new_quote_margin_percent: Decimal

    co_purchase_count: int
    promotion_name: str | None
    promotion_boost: Decimal

    recommendation_score: Decimal

    reason: str


class RecommendationAcceptRequest(BaseModel):
    source_product_id: str
    suggested_product_id: str
    discount_percent: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        le=100,
    )