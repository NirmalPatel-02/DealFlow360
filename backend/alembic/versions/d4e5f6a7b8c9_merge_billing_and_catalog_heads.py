"""merge billing and catalog migration heads

Revision ID: d4e5f6a7b8c9
Revises: c1b2d3e4f5a6, e4ac914a0ed8
"""
from typing import Sequence, Union


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = (
    "c1b2d3e4f5a6",
    "e4ac914a0ed8",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
