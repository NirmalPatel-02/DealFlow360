from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import ApprovalLevel, ApprovalStatus


class QuoteEvaluationResponse(BaseModel):
    risk_score: Decimal
    blended_excess_percent: Decimal
    max_excess_percent: Decimal
    requires_approval: bool
    highest_approval_level: ApprovalLevel | None
    violations: list[dict]


class SubmitQuoteResponse(BaseModel):
    quote_id: str
    status: str
    approval_version: int
    risk_score: Decimal
    approval_level_required: ApprovalLevel | None


class ApprovalActionRequest(BaseModel):
    action: str = Field(
        pattern="^(approve|reject|return)$"
    )
    reason: str | None = Field(
        default=None,
        max_length=2000,
    )


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    quotation_id: str
    approval_version: int
    step_order: int
    approval_level: ApprovalLevel
    status: ApprovalStatus
    acted_by_user_id: str | None
    acted_at: datetime | None
    reason: str | None