from decimal import Decimal
from datetime import datetime
from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CustomerTier, QuoteStatus


class Quotation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quotations"

    quote_number: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        unique=True,
        index=True,
    )

    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    created_by_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[QuoteStatus] = mapped_column(
        SQLEnum(
            QuoteStatus,
            native_enum=False,
            length=30,
        ),
        nullable=False,
        default=QuoteStatus.DRAFT,
        index=True,
    )

    customer_tier_snapshot: Mapped[CustomerTier] = mapped_column(
        SQLEnum(
            CustomerTier,
            native_enum=False,
            length=20,
        ),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    discount_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    tax_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    grand_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    gross_margin: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    gross_margin_percent: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    risk_score: Mapped[Decimal] = mapped_column(
        Numeric(8, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    customer = relationship("Customer")
    created_by = relationship("User")

    lines = relationship(
        "QuoteLine",
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="QuoteLine.line_number",
    )

    approval_level_required: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    approval_version: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
    )

    last_evaluated_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )