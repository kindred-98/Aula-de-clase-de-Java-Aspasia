"""Webhook de Stripe. La verificación de firma es OBLIGATORIA (secc. 6 del prompt).

Sin firma válida (o con la de otro secreto) → 400 y ningún efecto: este endpoint
es una puerta de entrada al sistema tan sensible como el login.
"""

import json
import logging

import stripe
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.core.config import settings
from app.models import StripeWebhookEvent
from app.security.policies import DbSession
from app.services.email import get_email_service
from app.services.stripe_webhooks import handle_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, db: DbSession) -> dict[str, str]:
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    secret = settings.stripe_webhook_secret
    if not secret.strip():
        raise HTTPException(status_code=400, detail="Webhook secret not configured")
    try:
        stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=secret,
        )
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid signature") from None

    # Firma verificada: procesar como JSON plano (StripeObject no admite .get)
    event = json.loads(payload)
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "")
    if not event_id:
        raise HTTPException(status_code=400, detail="Invalid payload")

    # Idempotencia: un evento repetido responde 200 sin re-ejecutar
    seen = db.scalar(select(StripeWebhookEvent).where(StripeWebhookEvent.event_id == event_id))
    if seen is not None:
        return {"received": "duplicate"}

    emails = handle_event(db, event)
    db.add(StripeWebhookEvent(event_id=event_id, event_type=event_type))
    db.commit()

    # Emails tras el commit: un fallo de envío no debe reintentar el evento
    service = get_email_service()
    for email in emails:
        try:
            service.send(email)
        except Exception:  # el webhook no debe fallar por un error de email
            logger.exception("No se pudo enviar el email a %s", email.to)
    return {"received": "ok"}
