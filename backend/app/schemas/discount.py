from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ApprovalLevel, CustomerTier


class ApprovalChainCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)


class ApprovalChainUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class ApprovalChainResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    is_active: bool


class ApprovalBandCreate(BaseModel):
    min_excess_percent: Decimal = Field(ge=0, le=100)
    max_excess_percent: Decimal | None = Field(default=None, gt=0, le=100)
    approval_level: ApprovalLevel

    @model_validator(mode="after")
    def validate_range(self):
        if (
            self.max_excess_percent is not None
            and self.max_excess_percent <= self.min_excess_percent
        ):
            raise ValueError(
                "max_excess_percent must be greater than min_excess_percent."
            )
        return self


class ApprovalBandUpdate(BaseModel):
    min_excess_percent: Decimal | None = Field(default=None, ge=0, le=100)
    max_excess_percent: Decimal | None = Field(default=None, gt=0, le=100)
    approval_level: ApprovalLevel | None = None


class ApprovalBandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    approval_chain_id: str
    min_excess_percent: Decimal
    max_excess_percent: Decimal | None
    approval_level: ApprovalLevel


class DiscountRuleCreate(BaseModel):
    customer_tier: CustomerTier
    category_id: str | None = None
    max_discount_percent: Decimal = Field(ge=0, le=100)
    approval_chain_id: str


class DiscountRuleUpdate(BaseModel):
    max_discount_percent: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )
    approval_chain_id: str | None = None
    is_active: bool | None = None


class DiscountRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_tier: CustomerTier
    category_id: str | None
    max_discount_percent: Decimal
    approval_chain_id: str
    is_active: bool


class DiscountEvaluationRequest(BaseModel):
    customer_tier: CustomerTier
    category_id: str
    requested_discount_percent: Decimal = Field(
        ge=0,
        le=100,
    )


class DiscountEvaluationResponse(BaseModel):
    allowed_discount_percent: Decimal
    requested_discount_percent: Decimal
    excess_percent: Decimal
    requires_approval: bool
    approval_level: ApprovalLevel | None
    rule_id: str
    rule_scope: str