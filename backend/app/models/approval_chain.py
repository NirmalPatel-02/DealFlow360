from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ApprovalChain(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "approval_chains"

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    bands = relationship(
        "ApprovalBand",
        back_populates="approval_chain",
        cascade="all, delete-orphan",
        order_by="ApprovalBand.min_excess_percent",
    )

    discount_rules = relationship(
        "DiscountRule",
        back_populates="approval_chain",
    )