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
    # Drop existing foreign keys referencing users
    op.drop_constraint('orders_ibfk_1', 'orders', type_='foreignkey')
    op.drop_constraint('invoices_ibfk_2', 'invoices', type_='foreignkey')
    op.drop_constraint('subscriptions_ibfk_2', 'subscriptions', type_='foreignkey')
    op.drop_constraint('payments_ibfk_3', 'payments', type_='foreignkey')
    op.drop_constraint('credit_notes_ibfk_3', 'credit_notes', type_='foreignkey')

    # Create foreign keys referencing customers
    op.create_foreign_key('fk_orders_customer_id_customers', 'orders', 'customers', ['customer_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_invoices_customer_id_customers', 'invoices', 'customers', ['customer_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_subscriptions_customer_id_customers', 'subscriptions', 'customers', ['customer_id'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_payments_customer_id_customers', 'payments', 'customers', ['customer_id'], ['id'])
    op.create_foreign_key('fk_credit_notes_customer_id_customers', 'credit_notes', 'customers', ['customer_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_credit_notes_customer_id_customers', 'credit_notes', type_='foreignkey')
    op.drop_constraint('fk_payments_customer_id_customers', 'payments', type_='foreignkey')
    op.drop_constraint('fk_subscriptions_customer_id_customers', 'subscriptions', type_='foreignkey')
    op.drop_constraint('fk_invoices_customer_id_customers', 'invoices', type_='foreignkey')
    op.drop_constraint('fk_orders_customer_id_customers', 'orders', type_='foreignkey')

    op.create_foreign_key('credit_notes_ibfk_3', 'credit_notes', 'users', ['customer_id'], ['id'])
    op.create_foreign_key('payments_ibfk_3', 'payments', 'users', ['customer_id'], ['id'])
    op.create_foreign_key('subscriptions_ibfk_2', 'subscriptions', 'users', ['customer_id'], ['id'])
    op.create_foreign_key('invoices_ibfk_2', 'invoices', 'users', ['customer_id'], ['id'])
    op.create_foreign_key('orders_ibfk_1', 'orders', 'users', ['customer_id'], ['id'])
