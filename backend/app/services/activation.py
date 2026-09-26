"""Activación de cuentas creadas por el webhook de Stripe (token de un solo uso, 48 h).

Solo se persiste el hash sha256 del token; el valor en claro solo viaja por email.
"""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_secret
from app.models import User
from app.services.audit import log_action

ACTIVATION_TOKEN_HOURS = 48


class ActivationError(Exception):
    """Token de activación inválido, expirado o ya consumido."""

    def __init__(self, detail: str = "Invalid or expired activation token") -> None:
        super().__init__(detail)
        self.detail = detail


def _hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def generate_activation_token(user: User) -> str:
    """Asigna hash + expiración al usuario y devuelve el token en claro (para el email)."""
    token = token_urlsafe(32)
    user.activation_token_hash = _hash_token(token)
    user.activation_token_expires_at = datetime.now(UTC) + timedelta(hours=ACTIVATION_TOKEN_HOURS)
    return token


def find_user_by_activation_token(db: Session, token: str) -> User | None:
    """Usuario con ese token aún válido; None si no existe o ya expiró."""
    if not token:
        return None
    user = db.scalar(select(User).where(User.activation_token_hash == _hash_token(token)))
    if user is None:
        return None
    expires = user.activation_token_expires_at
    if expires is None:
        return None
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        return None
    return user


def activate_account(db: Session, *, token: str, password: str) -> User:
    """Crea la contraseña y consume el token (uso único). Lanza ActivationError."""
    user = find_user_by_activation_token(db, token)
    if user is None:
        raise ActivationError()
    user.password_hash = hash_secret(password)
    user.must_change_credentials = False
    user.activation_token_hash = None
    user.activation_token_expires_at = None
    log_action(
        db,
        action="auth.account_activated",
        actor_id=user.id,
        payload={"email": user.email},
    )
    db.commit()
    db.refresh(user)
    return user
