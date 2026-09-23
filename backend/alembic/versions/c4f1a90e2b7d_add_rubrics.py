"""add rubrics and assignments.rubric_id

Revision ID: c4f1a90e2b7d
Revises: 2b87aadf33ae
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c4f1a90e2b7d'
down_revision: Union[str, None] = '2b87aadf33ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rubrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column(
            'criteria',
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'),
            server_default='[]',
            nullable=False,
        ),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['course_id'],
            ['courses.id'],
            name=op.f('fk_rubrics_course_id_courses'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['created_by'],
            ['users.id'],
            name=op.f('fk_rubrics_created_by_users'),
            ondelete='RESTRICT',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_rubrics')),
    )
    op.create_index(op.f('ix_rubrics_course_id'), 'rubrics', ['course_id'], unique=False)
    op.create_index(op.f('ix_rubrics_created_by'), 'rubrics', ['created_by'], unique=False)
    op.add_column(
        'assignments',
        sa.Column('rubric_id', sa.Integer(), nullable=True),
    )
    with op.batch_alter_table('assignments', schema=None) as batch_op:
        batch_op.create_foreign_key(
            op.f('fk_assignments_rubric_id_rubrics'),
            'rubrics',
            ['rubric_id'],
            ['id'],
            ondelete='SET NULL',
        )
    op.create_index(op.f('ix_assignments_rubric_id'), 'assignments', ['rubric_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_assignments_rubric_id'), table_name='assignments')
    with op.batch_alter_table('assignments', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('fk_assignments_rubric_id_rubrics'), type_='foreignkey')
    op.drop_column('assignments', 'rubric_id')
    op.drop_index(op.f('ix_rubrics_created_by'), table_name='rubrics')
    op.drop_index(op.f('ix_rubrics_course_id'), table_name='rubrics')
    op.drop_table('rubrics')
