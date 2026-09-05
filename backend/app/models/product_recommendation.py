from decimal import Decimal

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProductRecommendationRule(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "product_recommendation_rules"

    source_product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    suggested_product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    co_purchase_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    recommendation_weight: Mapped[Decimal] = mapped_column(
        Numeric(8, 2),
        nullable=False,
        default=Decimal("1.00"),
    )

    minimum_margin_percent: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
        default=Decimal("10.00"),
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    source_product = relationship(
        "Product",
        foreign_keys=[source_product_id],
    )

    suggested_product = relationship(
        "Product",
        foreign_keys=[suggested_product_id],
    )

    __table_args__ = (
        UniqueConstraint(
            "source_product_id",
            "suggested_product_id",
            name="uq_recommendation_source_suggested",
        ),
    )