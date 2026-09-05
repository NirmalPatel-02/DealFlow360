from decimal import Decimal

from sqlalchemy import Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import FulfillmentAllocationStatus


class FulfillmentAllocation(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "fulfillment_allocations"

    fulfillment_plan_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "fulfillment_plans.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    quote_line_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "quote_lines.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    warehouse_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "warehouses.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    requested_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
    )

    allocated_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=Decimal("0.000"),
    )

    fulfilled_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=Decimal("0.000"),
    )

    shipment_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    status: Mapped[FulfillmentAllocationStatus] = mapped_column(
        SQLEnum(
            FulfillmentAllocationStatus,
            native_enum=False,
            length=30,
        ),
        nullable=False,
        default=FulfillmentAllocationStatus.RESERVED,
    )

    manual_override: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    plan = relationship(
        "FulfillmentPlan",
        back_populates="allocations",
    )

    quote_line = relationship("QuoteLine")
    warehouse = relationship("Warehouse")