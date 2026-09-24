"""add scale models (Fase D): categories, cohorts, custom roles

Revision ID: d9a4b5c6e7f8
Revises: c8f5e1a2b3d4
Create Date: 2026-09-24 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd9a4b5c6e7f8'
down_revision: Union[str, None] = 'c8f5e1a2b3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'course_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('slug', sa.String(length=80), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_course_categories')),
    )
    op.create_index(op.f('ix_course_categories_slug'), 'course_categories', ['slug'], unique=True)

    op.create_table(
        'custom_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column(
            'permissions',
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'),
            server_default='[]',
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_custom_roles')),
    )
    op.create_index(op.f('ix_custom_roles_name'), 'custom_roles', ['name'], unique=True)

    op.create_table(
        'cohorts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('code', sa.String(length=16), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['category_id'],
            ['course_categories.id'],
            name=op.f('fk_cohorts_category_id_course_categories'),
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_cohorts')),
    )
    op.create_index(op.f('ix_cohorts_category_id'), 'cohorts', ['category_id'], unique=False)
    op.create_index(op.f('ix_cohorts_code'), 'cohorts', ['code'], unique=True)

    op.create_table(
        'cohort_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cohort_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['cohort_id'],
            ['cohorts.id'],
            name=op.f('fk_cohort_members_cohort_id_cohorts'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['student_id'],
            ['users.id'],
            name=op.f('fk_cohort_members_student_id_users'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_cohort_members')),
        sa.UniqueConstraint('cohort_id', 'student_id', name='uq_cohort_student'),
    )
    op.create_index(op.f('ix_cohort_members_cohort_id'), 'cohort_members', ['cohort_id'], unique=False)
    op.create_index(op.f('ix_cohort_members_student_id'), 'cohort_members', ['student_id'], unique=False)

    op.add_column('courses', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('courses', sa.Column('cohort_id', sa.Integer(), nullable=True))
    with op.batch_alter_table('courses', schema=None) as batch_op:
        batch_op.create_foreign_key(
            op.f('fk_courses_category_id_course_categories'),
            'course_categories',
            ['category_id'],
            ['id'],
            ondelete='SET NULL',
        )
        batch_op.create_foreign_key(
            op.f('fk_courses_cohort_id_cohorts'),
            'cohorts',
            ['cohort_id'],
            ['id'],
            ondelete='SET NULL',
        )
    op.create_index(op.f('ix_courses_category_id'), 'courses', ['category_id'], unique=False)
    op.create_index(op.f('ix_courses_cohort_id'), 'courses', ['cohort_id'], unique=False)

    op.add_column('users', sa.Column('custom_role_id', sa.Integer(), nullable=True))
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_foreign_key(
            op.f('fk_users_custom_role_id_custom_roles'),
            'custom_roles',
            ['custom_role_id'],
            ['id'],
            ondelete='SET NULL',
        )
    op.create_index(op.f('ix_users_custom_role_id'), 'users', ['custom_role_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_custom_role_id'), table_name='users')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('fk_users_custom_role_id_custom_roles'), type_='foreignkey')
    op.drop_column('users', 'custom_role_id')

    op.drop_index(op.f('ix_courses_cohort_id'), table_name='courses')
    op.drop_index(op.f('ix_courses_category_id'), table_name='courses')
    with op.batch_alter_table('courses', schema=None) as batch_op:
        batch_op.drop_constraint(op.f('fk_courses_cohort_id_cohorts'), type_='foreignkey')
        batch_op.drop_constraint(op.f('fk_courses_category_id_course_categories'), type_='foreignkey')
    op.drop_column('courses', 'cohort_id')
    op.drop_column('courses', 'category_id')

    op.drop_index(op.f('ix_cohort_members_student_id'), table_name='cohort_members')
    op.drop_index(op.f('ix_cohort_members_cohort_id'), table_name='cohort_members')
    op.drop_table('cohort_members')
    op.drop_index(op.f('ix_cohorts_code'), table_name='cohorts')
    op.drop_index(op.f('ix_cohorts_category_id'), table_name='cohorts')
    op.drop_table('cohorts')
    op.drop_index(op.f('ix_custom_roles_name'), table_name='custom_roles')
    op.drop_table('custom_roles')
    op.drop_index(op.f('ix_course_categories_slug'), table_name='course_categories')
    op.drop_table('course_categories')
