from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import CustomerTier


class DiscountRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "discount_rules"

    customer_tier: Mapped[CustomerTier] = mapped_column(
        SQLEnum(
            CustomerTier,
            native_enum=False,
            length=20,
        ),
        nullable=False,
        index=True,
    )

    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    max_discount_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )

    approval_chain_id: Mapped[str] = mapped_column(
        ForeignKey("approval_chains.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    category = relationship("Category")

    approval_chain = relationship(
        "ApprovalChain",
        back_populates="discount_rules",
    )