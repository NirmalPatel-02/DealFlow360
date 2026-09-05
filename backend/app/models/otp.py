from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class OTPCode(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "otp_codes"

    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(254),
        nullable=False,
        index=True,
    )

    purpose: Mapped[str] = mapped_column(
        Enum(
            "email_verification",
            "password_reset",
            name="otp_purpose",
        ),
        nullable=False,
    )

    code_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    max_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    requested_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_otp_email_purpose_created", "email", "purpose", "created_at"),
        Index("ix_otp_ip_purpose_created", "requested_ip", "purpose", "created_at"),
    )