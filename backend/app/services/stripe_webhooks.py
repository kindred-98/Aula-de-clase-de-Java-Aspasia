"""Efectos de los eventos de Stripe sobre organizaciones y usuarios.

La verificación de firma ocurre en la ruta (`routes/webhooks.py`); aquí solo
se procesa el evento ya autenticado. Devuelve los emails a enviar **después**
del commit (best-effort: un fallo de email no revierte el evento).
"""

import logging
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Organization, OrgStatus, User, UserRole
from app.services.activation import generate_activation_token
from app.services.email import OutboundEmail
from app.services.stripe_billing import TRIAL_PERIOD_DAYS

logger = logging.getLogger(__name__)

TRIAL_END_WARNING_DAYS = 3


def handle_event(db: Session, event: Mapping[str, Any]) -> list[OutboundEmail]:
    """Aplica el evento y devuelve los emails pendientes de enviar."""
    event_type = str(event.get("type", ""))
    data = event.get("data")
    obj: Mapping[str, Any] = {}
    if isinstance(data, Mapping):
        inner = data.get("object")
        if isinstance(inner, Mapping):
            obj = inner

    if event_type == "checkout.session.completed":
        return _on_checkout_completed(db, obj)
    if event_type == "customer.subscription.trial_will_end":
        return _on_trial_will_end(db, obj)
    if event_type == "invoice.payment_succeeded":
        _on_status_change(db, obj, OrgStatus.active)
    elif event_type == "invoice.payment_failed":
        _on_status_change(db, obj, OrgStatus.past_due)
    elif event_type == "customer.subscription.deleted":
        _on_status_change(db, obj, OrgStatus.canceled)
    return []


def _as_int(value: object) -> int | None:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _org_by_metadata(db: Session, obj: Mapping[str, Any]) -> Organization | None:
    metadata = obj.get("metadata")
    if not isinstance(metadata, Mapping):
        return None
    org_id = _as_int(metadata.get("organization_id"))
    if org_id is None:
        return None
    return db.get(Organization, org_id)


def _extract_subscription_id(obj: Mapping[str, Any]) -> str | None:
    """Id de suscripción en invoice (legado `subscription` o `parent.*`)."""
    sub = obj.get("subscription")
    if isinstance(sub, str):
        return sub
    if isinstance(sub, Mapping):
        sid = sub.get("id")
        return str(sid) if sid else None
    parent = obj.get("parent")
    if isinstance(parent, Mapping):
        details = parent.get("subscription_details")
        if isinstance(details, Mapping):
            nested = details.get("subscription")
            if isinstance(nested, str):
                return nested
            if isinstance(nested, Mapping):
                sid = nested.get("id")
                return str(sid) if sid else None
    return None


def _find_org(
    db: Session,
    obj: Mapping[str, Any],
    *,
    subscription_id: str | None,
) -> Organization | None:
    """Localiza la organización por suscripción, cliente o metadata."""
    if subscription_id:
        org = db.scalar(
            select(Organization).where(Organization.stripe_subscription_id == subscription_id)
        )
        if org is not None:
            return org
    customer = obj.get("customer")
    if isinstance(customer, str) and customer:
        org = db.scalar(select(Organization).where(Organization.stripe_customer_id == customer))
        if org is not None:
            return org
    return _org_by_metadata(db, obj)


def _on_checkout_completed(db: Session, obj: Mapping[str, Any]) -> list[OutboundEmail]:
    org = _org_by_metadata(db, obj)
    if org is None:
        logger.warning("checkout.session.completed sin organization_id en metadata")
        return []

    customer = obj.get("customer")
    if isinstance(customer, str) and customer:
        org.stripe_customer_id = customer
    subscription = obj.get("subscription")
    if isinstance(subscription, str) and subscription:
        org.stripe_subscription_id = subscription
    org.status = OrgStatus.trialing
    org.trial_ends_at = datetime.now(UTC) + timedelta(days=TRIAL_PERIOD_DAYS)

    existing_admin = db.scalar(
        select(User).where(
            User.organization_id == org.id,
            User.role == UserRole.org_admin,
        )
    )
    if existing_admin is not None:
        return []  # ya se creó (evento repetido con otro id)

    email = org.billing_email
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        logger.warning("No se creó org_admin: el email %s ya existe en otra cuenta", email)
        return []

    admin = User(
        name=org.name,
        email=email,
        role=UserRole.org_admin,
        organization_id=org.id,
        password_hash=None,  # no puede iniciar sesión hasta activar
        is_active=True,
        must_change_credentials=False,
    )
    db.add(admin)
    db.flush()
    token = generate_activation_token(admin)
    return [_activation_email(org=org, email=email, token=token)]


def _on_trial_will_end(db: Session, obj: Mapping[str, Any]) -> list[OutboundEmail]:
    org = _find_org(db, obj, subscription_id=str(obj.get("id") or ""))
    if org is None:
        return []
    trial_end = obj.get("trial_end")
    when = org.trial_ends_at
    if isinstance(trial_end, (int, float)):
        when = datetime.fromtimestamp(trial_end, UTC)
    when_text = when.strftime("%d/%m/%Y") if when else "pronto"
    return [
        OutboundEmail(
            to=org.billing_email,
            subject="Tu periodo de prueba de Aspasia termina pronto",
            html=(
                f"<p>Hola {org.name},</p>"
                f"<p>Tu periodo de prueba de {TRIAL_PERIOD_DAYS} días termina el "
                f"<strong>{when_text}</strong>. Asegúrate de que tu método de pago "
                "sigue activo para no interrumpir el servicio.</p>"
                f"<p>{settings.app_name}</p>"
            ),
        )
    ]


def _on_status_change(db: Session, obj: Mapping[str, Any], status: OrgStatus) -> None:
    obj_id = str(obj.get("id") or "")
    subscription_id = obj_id if obj_id.startswith("sub_") else _extract_subscription_id(obj)
    org = _find_org(db, obj, subscription_id=subscription_id)
    if org is None:
        logger.warning("Evento sin organización asociada (status=%s)", status)
        return
    org.status = status
    customer = obj.get("customer")
    if isinstance(customer, str) and customer:
        org.stripe_customer_id = customer
    if subscription_id:
        org.stripe_subscription_id = subscription_id


def _activation_email(*, org: Organization, email: str, token: str) -> OutboundEmail:
    base = settings.public_base_url.rstrip("/")
    link = f"{base}/activar-cuenta/{token}"
    return OutboundEmail(
        to=email,
        subject="Activa tu cuenta de Aspasia",
        html=(
            f"<p>Hola {org.name},</p>"
            "<p>Tu suscripción está confirmada. Crea tu contraseña con este enlace "
            "(un solo uso, válido 48 horas):</p>"
            f'<p><a href="{link}">{link}</a></p>'
            "<p>Si tú no solicitaste esta cuenta, ignora este email.</p>"
        ),
    )
