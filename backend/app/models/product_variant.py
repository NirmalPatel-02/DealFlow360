from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ProductVariant(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "product_variants"

    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    attribute: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    value: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    sku: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
        unique=True,
    )

    extra_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    product = relationship("Product", back_populates="variants")

    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "attribute",
            "value",
            name="uq_product_variant_attribute_value",
        ),
    )