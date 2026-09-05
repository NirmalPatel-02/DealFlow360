from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(254),
        unique=True,
        index=True,
        nullable=False,
    )

    full_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        Enum(
            "sales_rep",
            "sales_manager",
            "finance",
            "operations",
            "customer",
            "admin",
            name="user_role",
        ),
        nullable=False,
        default="sales_rep",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    failed_login_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )