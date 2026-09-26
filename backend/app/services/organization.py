"""Utilidades de organizaciones (tenants) para scripts, seeds y CLI."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization, OrgStatus, User, UserRole

DEFAULT_ORG_NAME = "Organización por defecto"
DEFAULT_ORG_TAX_ID = "000000000A"
DEFAULT_ORG_BILLING_EMAIL = "admin@localhost"


def get_or_create_default_organization(
    db: Session, billing_email: str | None = None
) -> Organization:
    """Devuelve la primera organización existente o crea la de por defecto.

    `billing_email` solo se usa al crear: si la org ya existe se ignora.
    """
    org = db.scalar(select(Organization).order_by(Organization.id))
    if org is not None:
        return org
    first_staff_email = db.scalar(
        select(User.email)
        .where(User.role.in_([UserRole.org_admin, UserRole.super_admin]))
        .order_by(User.id)
    )
    org = Organization(
        name=DEFAULT_ORG_NAME,
        tax_id=DEFAULT_ORG_TAX_ID,
        billing_email=billing_email or first_staff_email or DEFAULT_ORG_BILLING_EMAIL,
        status=OrgStatus.active,
        plan_id="",
    )
    db.add(org)
    db.flush()
    return org
