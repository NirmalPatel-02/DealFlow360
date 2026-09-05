from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CustomerContact(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "customer_contacts"

    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    portal_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    customer = relationship("Customer", back_populates="contacts")
    user = relationship("User")