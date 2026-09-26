"""add organizations + multi-tenant roles (Fase A)

Revision ID: e1a2b3c4d5f6
Revises: d9a4b5c6e7f8
Create Date: 2026-09-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1a2b3c4d5f6'
down_revision: Union[str, None] = 'd9a4b5c6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ORG_STATUS = sa.Enum(
    'pending_payment', 'trialing', 'active', 'past_due', 'canceled', name='orgstatus'
)
USER_ROLES_OLD = sa.Enum('admin', 'teacher', 'student', name='userrole')
USER_ROLES_NEW = sa.Enum('super_admin', 'org_admin', 'teacher', 'student', name='userrole')
CHECK_SQL = (
    "(role = 'super_admin' AND organization_id IS NULL) "
    "OR (role <> 'super_admin' AND organization_id IS NOT NULL)"
)
ROLE_CHECK_SQL = "role IN ('super_admin', 'org_admin', 'teacher', 'student')"


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Organizaciones (tenants)
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('tax_id', sa.String(length=32), nullable=False),
        sa.Column('billing_email', sa.String(length=320), nullable=False),
        sa.Column('status', ORG_STATUS, nullable=False),
        sa.Column('plan_id', sa.String(length=64), nullable=False),
        sa.Column('stripe_customer_id', sa.String(length=64), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(length=64), nullable=True),
        sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_organizations')),
        sa.UniqueConstraint('stripe_customer_id', name=op.f('uq_organizations_stripe_customer_id')),
        sa.UniqueConstraint('stripe_subscription_id', name=op.f('uq_organizations_stripe_subscription_id')),
    )
    op.create_index(op.f('ix_organizations_status'), 'organizations', ['status'], unique=False)

    # 2) Columnas nuevas en users (sin FK todavía: SQLite no permite
    #    ALTER ... ADD CONSTRAINT; la FK entra en el batch del paso 5)
    op.add_column('users', sa.Column('organization_id', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('activation_token_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('activation_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_users_organization_id'), 'users', ['organization_id'], unique=False)

    # 3) Organización por defecto (la tabla acaba de crearse: siempre vacía)
    op.execute(
        sa.text(
            "INSERT INTO organizations (name, tax_id, billing_email, status, plan_id, created_at) "
            "VALUES ('Organización por defecto', '000000000A', "
            "COALESCE((SELECT email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1), 'admin@localhost'), "
            "'active', '', CURRENT_TIMESTAMP)"
        )
    )
    org_id = bind.execute(sa.text("SELECT id FROM organizations ORDER BY id LIMIT 1")).scalar_one()

    # 4) Backfill de roles y organización: admin -> org_admin; todos los no
    #    super_admin pasan a la organización por defecto
    op.execute(sa.text("UPDATE users SET role = 'org_admin' WHERE role = 'admin'"))
    bind.execute(
        sa.text("UPDATE users SET organization_id = :org WHERE role <> 'super_admin'"),
        {"org": org_id},
    )

    # 5) FK + nuevo enum de roles + CHECK de la invariante multi-tenant
    if bind.dialect.name == 'postgresql':
        # ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de una transacción:
        # renombrar + recrear el tipo es el camino seguro en PostgreSQL
        op.create_foreign_key(
            'fk_users_organization_id_organizations',
            'users',
            'organizations',
            ['organization_id'],
            ['id'],
        )
        bind.execute(sa.text("ALTER TYPE userrole RENAME TO userrole_old"))
        USER_ROLES_NEW.create(bind, checkfirst=False)
        bind.execute(
            sa.text(
                "ALTER TABLE users ALTER COLUMN role TYPE userrole "
                "USING (CASE WHEN role = 'admin' THEN 'org_admin' ELSE role END)::userrole"
            )
        )
        bind.execute(sa.text("DROP TYPE userrole_old"))
        # las naming conventions de Base.metadata añaden ck_<tabla>_ al nombre dado
        op.create_check_constraint('org_by_role', 'users', CHECK_SQL)
        op.create_check_constraint('role_valid', 'users', ROLE_CHECK_SQL)
    else:
        # SQLite no puede alterar tipo/nullabilidad ni añadir constraints:
        # batch recrea users con los datos ya backfilleados
        with op.batch_alter_table('users') as batch_op:
            batch_op.alter_column(
                'role',
                existing_type=USER_ROLES_OLD,
                type_=USER_ROLES_NEW,
                existing_nullable=False,
            )
            batch_op.create_foreign_key(
                'fk_users_organization_id_organizations',
                'organizations',
                ['organization_id'],
                ['id'],
            )
            batch_op.create_check_constraint('org_by_role', CHECK_SQL)
            batch_op.create_check_constraint('role_valid', ROLE_CHECK_SQL)

    # 6) courses.organization_id NOT NULL + backfill + FK
    op.add_column('courses', sa.Column('organization_id', sa.Integer(), nullable=True))
    bind.execute(sa.text("UPDATE courses SET organization_id = :org"), {"org": org_id})
    with op.batch_alter_table('courses') as batch_op:
        batch_op.alter_column(
            'organization_id',
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.create_foreign_key(
            'fk_courses_organization_id_organizations',
            'organizations',
            ['organization_id'],
            ['id'],
        )
    op.create_index(op.f('ix_courses_organization_id'), 'courses', ['organization_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    # courses: eliminar columna organization_id
    op.drop_index(op.f('ix_courses_organization_id'), table_name='courses')
    with op.batch_alter_table('courses') as batch_op:
        batch_op.drop_column('organization_id')

    # users: sin super_admin en el esquema monolítico antiguo
    op.drop_index(op.f('ix_users_organization_id'), table_name='users')
    bind.execute(sa.text("DELETE FROM users WHERE role = 'super_admin'"))
    if bind.dialect.name == 'postgresql':
        # los CHECK caen antes de tocar el tipo de role; el backfill inverso
        # (org_admin -> admin) se resuelve en el USING del ALTER de tipo
        op.drop_constraint('org_by_role', 'users', type_='check')
        op.drop_constraint('role_valid', 'users', type_='check')
        bind.execute(sa.text("ALTER TYPE userrole RENAME TO userrole_new"))
        USER_ROLES_OLD.create(bind, checkfirst=False)
        bind.execute(
            sa.text(
                "ALTER TABLE users ALTER COLUMN role TYPE userrole "
                "USING (CASE WHEN role = 'org_admin' THEN 'admin' ELSE role END)::userrole"
            )
        )
        bind.execute(sa.text("DROP TYPE userrole_new"))
    else:
        # los CHECK deben caerse antes del backfill inverso: 'admin' ya no
        # pertenece al dominio de roles
        with op.batch_alter_table('users') as batch_op:
            batch_op.drop_constraint('org_by_role', type_='check')
            batch_op.drop_constraint('role_valid', type_='check')
        bind.execute(sa.text("UPDATE users SET role = 'admin' WHERE role = 'org_admin'"))
        with op.batch_alter_table('users') as batch_op:
            batch_op.alter_column(
                'role',
                existing_type=USER_ROLES_NEW,
                type_=USER_ROLES_OLD,
                existing_nullable=False,
            )
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_constraint('fk_users_organization_id_organizations', type_='foreignkey')
        batch_op.drop_column('organization_id')
        batch_op.drop_column('activation_token_hash')
        batch_op.drop_column('activation_token_expires_at')

    # organizations al final (las FKs ya no existen)
    op.drop_index(op.f('ix_organizations_status'), table_name='organizations')
    op.drop_table('organizations')
