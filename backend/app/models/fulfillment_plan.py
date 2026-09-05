from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import FulfillmentPlanStatus


class FulfillmentPlan(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "fulfillment_plans"

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    status: Mapped[FulfillmentPlanStatus] = mapped_column(
        SQLEnum(
            FulfillmentPlanStatus,
            native_enum=False,
            length=30,
        ),
        nullable=False,
        default=FulfillmentPlanStatus.PROPOSED,
    )

    estimated_shipment_count: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
    )

    estimated_shipping_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    quotation = relationship("Quotation")

    allocations = relationship(
        "FulfillmentAllocation",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="FulfillmentAllocation.created_at",
    )