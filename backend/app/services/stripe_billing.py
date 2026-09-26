"""Alta de organización: Stripe Checkout Session (mode=subscription, trial 14 días).

La tarjeta se teclea en Stripe; esta sesión solo la crea y devuelve su URL.
"""

import stripe

from app.core.config import settings
from app.models import Organization
from app.services.plans import Plan

TRIAL_PERIOD_DAYS = 14


class StripeBillingError(Exception):
    """No se pudo crear la sesión de Checkout (la ruta responde 502)."""


def create_checkout_session(org: Organization, plan: Plan) -> str:
    if not settings.stripe_secret_key.strip():
        raise StripeBillingError("STRIPE_SECRET_KEY no configurado")
    if not plan.stripe_price_id:
        raise StripeBillingError(f"STRIPE_PRICE_{plan.id.upper()} no configurado")

    stripe.api_key = settings.stripe_secret_key
    base = settings.public_base_url.rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=org.billing_email,
            line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
            subscription_data={
                "metadata": {"organization_id": str(org.id)},
                "trial_period_days": TRIAL_PERIOD_DAYS,
            },
            metadata={"organization_id": str(org.id)},
            payment_method_collection="always",
            success_url=f"{base}/registro-empresa?estado=exito",
            cancel_url=f"{base}/registro-empresa?estado=cancelado",
        )
    except stripe.StripeError as exc:
        raise StripeBillingError(str(exc)) from exc
    if not session.url:
        raise StripeBillingError("Stripe no devolvió la URL de Checkout")
    return str(session.url)
