"""add course_messages and course_message_reads

Revision ID: b7e2d4f1a9c3
Revises: a1f3c9d2e8b4
Create Date: 2026-09-24 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e2d4f1a9c3'
down_revision: Union[str, None] = 'a1f3c9d2e8b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'course_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['course_id'],
            ['courses.id'],
            name=op.f('fk_course_messages_course_id_courses'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['sender_id'],
            ['users.id'],
            name=op.f('fk_course_messages_sender_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_course_messages')),
    )
    op.create_index(op.f('ix_course_messages_course_id'), 'course_messages', ['course_id'], unique=False)
    op.create_index(op.f('ix_course_messages_sender_id'), 'course_messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_course_messages_created_at'), 'course_messages', ['created_at'], unique=False)
    op.create_index(
        'ix_course_messages_course_time',
        'course_messages',
        ['course_id', 'created_at'],
        unique=False,
    )

    op.create_table(
        'course_message_reads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('last_read_id', sa.Integer(), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['users.id'],
            name=op.f('fk_course_message_reads_user_id_users'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['course_id'],
            ['courses.id'],
            name=op.f('fk_course_message_reads_course_id_courses'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_course_message_reads')),
        sa.UniqueConstraint('user_id', 'course_id', name='uq_course_message_reads_user_course'),
    )
    op.create_index(op.f('ix_course_message_reads_user_id'), 'course_message_reads', ['user_id'], unique=False)
    op.create_index(op.f('ix_course_message_reads_course_id'), 'course_message_reads', ['course_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_course_message_reads_course_id'), table_name='course_message_reads')
    op.drop_index(op.f('ix_course_message_reads_user_id'), table_name='course_message_reads')
    op.drop_table('course_message_reads')
    op.drop_index('ix_course_messages_course_time', table_name='course_messages')
    op.drop_index(op.f('ix_course_messages_created_at'), table_name='course_messages')
    op.drop_index(op.f('ix_course_messages_sender_id'), table_name='course_messages')
    op.drop_index(op.f('ix_course_messages_course_id'), table_name='course_messages')
    op.drop_table('course_messages')
