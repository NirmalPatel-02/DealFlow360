from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class InventoryStock(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory_stock"

    warehouse_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("warehouses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    variant_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("product_variants.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    quantity_on_hand: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=Decimal("0.000"),
    )

    quantity_reserved: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=Decimal("0.000"),
    )

    warehouse = relationship(
        "Warehouse",
        back_populates="stocks",
    )

    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        UniqueConstraint(
            "warehouse_id",
            "product_id",
            "variant_id",
            name="uq_inventory_warehouse_product_variant",
        ),
    )