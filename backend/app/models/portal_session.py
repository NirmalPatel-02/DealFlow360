from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PortalSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "portal_sessions"

    customer_contact_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "customer_contacts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey(
            "quotations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(),
        nullable=True,
    )

    customer_contact = relationship("CustomerContact")
    quotation = relationship("Quotation")