from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ApprovalLevel


class ApprovalBand(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "approval_bands"

    approval_chain_id: Mapped[str] = mapped_column(
        ForeignKey("approval_chains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    min_excess_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )

    max_excess_percent: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )

    approval_level: Mapped[ApprovalLevel] = mapped_column(
        SQLEnum(
            ApprovalLevel,
            native_enum=False,
            length=30,
        ),
        nullable=False,
    )

    approval_chain = relationship(
        "ApprovalChain",
        back_populates="bands",
    )