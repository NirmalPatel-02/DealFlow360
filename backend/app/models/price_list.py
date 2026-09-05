from sqlalchemy import Boolean, Enum as SQLEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CustomerTier


class PriceList(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "price_lists"

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    customer_tier: Mapped[CustomerTier] = mapped_column(
        SQLEnum(CustomerTier, native_enum=False, length=20),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    items = relationship(
        "PriceListItem",
        back_populates="price_list",
        cascade="all, delete-orphan",
    )