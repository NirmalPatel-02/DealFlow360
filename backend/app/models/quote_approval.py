from datetime import datetime

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ApprovalLevel, ApprovalStatus


class QuoteApproval(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "quote_approvals"

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    approval_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    step_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    approval_level: Mapped[ApprovalLevel] = mapped_column(
        SQLEnum(
            ApprovalLevel,
            native_enum=False,
            length=30,
        ),
        nullable=False,
    )

    status: Mapped[ApprovalStatus] = mapped_column(
        SQLEnum(
            ApprovalStatus,
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=ApprovalStatus.PENDING,
    )

    acted_by_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    acted_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    quotation = relationship("Quotation")
    acted_by = relationship("User")