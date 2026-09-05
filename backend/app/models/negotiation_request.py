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
from app.models.enums import NegotiationStatus


class NegotiationRequest(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "negotiation_requests"

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "quotations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    customer_contact_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "customer_contacts.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    quote_line_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(
            "quote_lines.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    requested_discount_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    requested_quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
        nullable=True,
    )

    status: Mapped[NegotiationStatus] = mapped_column(
        SQLEnum(
            NegotiationStatus,
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=NegotiationStatus.OPEN,
        index=True,
    )

    resolved_by_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    resolution_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    quotation = relationship("Quotation")
    customer_contact = relationship("CustomerContact")
    quote_line = relationship("QuoteLine")
    resolved_by = relationship("User")