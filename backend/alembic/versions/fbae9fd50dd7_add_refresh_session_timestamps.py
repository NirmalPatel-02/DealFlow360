"""add refresh session timestamps

Revision ID: fbae9fd50dd7
Revises: b02c24c64eb1
Create Date: 2026-09-05 12:00:22.952498
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "fbae9fd50dd7"
down_revision: Union[str, Sequence[str], None] = "b02c24c64eb1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "refresh_sessions",
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("refresh_sessions", "updated_at")