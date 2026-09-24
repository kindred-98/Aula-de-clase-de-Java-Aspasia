"""add system_settings (Fase C)

Revision ID: c8f5e1a2b3d4
Revises: b7e2d4f1a9c3
Create Date: 2026-09-24 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8f5e1a2b3d4'
down_revision: Union[str, None] = 'b7e2d4f1a9c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=80), nullable=False),
        sa.Column('value', sa.JSON(), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('key', name=op.f('pk_system_settings')),
    )


def downgrade() -> None:
    op.drop_table('system_settings')
