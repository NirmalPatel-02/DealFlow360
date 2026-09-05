from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReplenishmentRule(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "replenishment_rules"

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

    reorder_point: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
    )

    reorder_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
    )

    max_stock: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3),
        nullable=True,
    )

    warehouse = relationship(
        "Warehouse",
        back_populates="replenishment_rules",
    )

    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        UniqueConstraint(
            "warehouse_id",
            "product_id",
            "variant_id",
            name="uq_replenishment_warehouse_product_variant",
        ),
    )