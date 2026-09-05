from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RecommendationEvent(
    Base,
    UUIDPrimaryKeyMixin,
    TimestampMixin,
):
    __tablename__ = "recommendation_events"

    quotation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source_product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    suggested_product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
    )

    quotation = relationship("Quotation")
    source_product = relationship(
        "Product",
        foreign_keys=[source_product_id],
    )
    suggested_product = relationship(
        "Product",
        foreign_keys=[suggested_product_id],
    )
    user = relationship("User")