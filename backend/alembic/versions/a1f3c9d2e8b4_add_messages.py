"""add messages

Revision ID: a1f3c9d2e8b4
Revises: c4f1a90e2b7d
Create Date: 2026-09-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f3c9d2e8b4'
down_revision: Union[str, None] = 'c4f1a90e2b7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('recipient_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['sender_id'],
            ['users.id'],
            name=op.f('fk_messages_sender_id_users'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['recipient_id'],
            ['users.id'],
            name=op.f('fk_messages_recipient_id_users'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['course_id'],
            ['courses.id'],
            name=op.f('fk_messages_course_id_courses'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_messages')),
    )
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_messages_recipient_id'), 'messages', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_messages_course_id'), 'messages', ['course_id'], unique=False)
    op.create_index(op.f('ix_messages_created_at'), 'messages', ['created_at'], unique=False)
    op.create_index(
        'ix_messages_pair_time',
        'messages',
        ['sender_id', 'recipient_id', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_messages_pair_time', table_name='messages')
    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_messages_course_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_recipient_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_table('messages')
