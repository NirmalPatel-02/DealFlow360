from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PriceListItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "price_list_items"

    price_list_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("price_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    variant_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    price_list = relationship("PriceList", back_populates="items")
    product = relationship("Product", back_populates="price_items")
    variant = relationship("ProductVariant")

    __table_args__ = (
        UniqueConstraint(
            "price_list_id",
            "product_id",
            "variant_id",
            name="uq_price_list_product_variant",
        ),
    )