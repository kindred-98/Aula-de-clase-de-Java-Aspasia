"""Email transaccional con interfaz abstracta (cambiar de proveedor sin tocar el resto).

- `ResendEmailService`: REST de Resend vía httpx (producción).
- `ConsoleEmailService`: sin clave en desarrollo, el email va al log.
"""

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


@dataclass(frozen=True)
class OutboundEmail:
    to: str
    subject: str
    html: str


class EmailService(Protocol):
    def send(self, email: OutboundEmail) -> None: ...


class ResendEmailService:
    """Envío real vía Resend. `resend_api_key` es obligatoria en producción."""

    def __init__(self, api_key: str, from_email: str) -> None:
        self._api_key = api_key
        self._from_email = from_email

    def send(self, email: OutboundEmail) -> None:
        payload = {
            "from": self._from_email,
            "to": [email.to],
            "subject": email.subject,
            "html": email.html,
        }
        response = httpx.post(
            RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {self._api_key}"},
            timeout=10.0,
        )
        response.raise_for_status()


class ConsoleEmailService:
    """Modo desarrollo: sin proveedor, el email (con su enlace) va al log."""

    def send(self, email: OutboundEmail) -> None:
        logger.info(
            "EMAIL to=%s subject=%s\n%s",
            email.to,
            email.subject,
            email.html,
        )


def get_email_service() -> EmailService:
    if settings.resend_api_key.strip():
        return ResendEmailService(settings.resend_api_key, settings.email_from)
    return ConsoleEmailService()
