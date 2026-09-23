"""Primitivas de seguridad: hashing argon2 y JWT de corta duración."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

_hasher = PasswordHasher(time_cost=2, memory_cost=64 * 1024, parallelism=2)


def hash_secret(plain: str) -> str:
    """Hashear PIN o contraseña con argon2id. Nunca registrar `plain`."""
    return _hasher.hash(plain)


def verify_secret(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return _hasher.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    try:
        return _hasher.check_needs_rehash(hashed)
    except InvalidHashError:
        return True


def create_access_token(
    subject: str,
    *,
    role: str,
    expires_minutes: int | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(UTC)
    minutes = expires_minutes or settings.access_token_expire_minutes
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
        "jti": uuid4().hex,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token_value() -> str:
    """Valor plano del refresh token (se guarda solo su sha256)."""
    return uuid4().hex + uuid4().hex


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
