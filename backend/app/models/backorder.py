from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import BackorderStatus


class Backorder(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "backorders"

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "quotations.id",
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

    quantity_remaining: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
    )

    status: Mapped[BackorderStatus] = mapped_column(
        SQLEnum(
            BackorderStatus,
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=BackorderStatus.OPEN,
        index=True,
    )

    expected_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    quotation = relationship("Quotation")
    quote_line = relationship("QuoteLine")