"""add stripe_webhook_events (Fase B)

Revision ID: f4e5d6c7b8a9
Revises: e1a2b3c4d5f6
Create Date: 2026-09-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4e5d6c7b8a9'
down_revision: Union[str, None] = 'e1a2b3c4d5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotencia: cada evento de Stripe se registra una sola vez
    op.create_table(
        'stripe_webhook_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.String(length=255), nullable=False),
        sa.Column('event_type', sa.String(length=128), nullable=False),
        sa.Column(
            'received_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_stripe_webhook_events')),
        sa.UniqueConstraint('event_id', name=op.f('uq_stripe_webhook_events_event_id')),
    )


def downgrade() -> None:
    op.drop_table('stripe_webhook_events')
