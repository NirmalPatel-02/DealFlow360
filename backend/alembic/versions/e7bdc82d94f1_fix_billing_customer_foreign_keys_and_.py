"""fix billing customer foreign keys and quote order uniqueness

Revision ID: e7bdc82d94f1
Revises: d975dbe62f48
Create Date: 2026-09-06 01:14:43.838699

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7bdc82d94f1'
down_revision: Union[str, Sequence[str], None] = 'd975dbe62f48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
