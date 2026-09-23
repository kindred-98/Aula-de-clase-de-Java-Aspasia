"""Servicio de autenticación: login, refresh rotatorio, rate limit, cambios."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token_value,
    hash_secret,
    verify_secret,
)
from app.models import AuditLog, Course, CourseStatus, Enrollment, RefreshToken, User, UserRole
from app.services.audit import log_action

FAILED_LOGIN_ACTION = "auth.login_failed"
LOGIN_WINDOW_MINUTES = 15
MAX_FAILED_ATTEMPTS = 5
REFRESH_COOKIE_PATH = "/api/v1/auth"


class AuthError(Exception):
    """Error de autenticación genérico (mensaje no revela existencia)."""

    def __init__(self, detail: str, status_code: int = 401) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _hash_refresh(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _client_ip(ip: str | None) -> str:
    return ip or "unknown"


def count_recent_failures(
    db: Session,
    *,
    identifier: str | None = None,
    ip: str | None = None,
) -> int:
    since = datetime.now(UTC) - timedelta(minutes=LOGIN_WINDOW_MINUTES)
    stmt = (
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.action == FAILED_LOGIN_ACTION,
            AuditLog.created_at >= since,
        )
    )
    conds = []
    if identifier:
        conds.append(AuditLog.payload["identifier"].as_string() == identifier)
    if ip:
        conds.append(AuditLog.ip == ip)
    if conds:
        from sqlalchemy import or_

        stmt = stmt.where(or_(*conds))
    return int(db.scalar(stmt) or 0)


def record_failed_login(
    db: Session,
    *,
    identifier: str,
    ip: str | None,
    course_id: int | None = None,
    reason: str = "bad_credentials",
) -> None:
    log_action(
        db,
        action=FAILED_LOGIN_ACTION,
        course_id=course_id,
        payload={"identifier": identifier, "reason": reason},
        ip=_client_ip(ip),
    )


def _is_locked(db: Session, *, identifier: str, ip: str | None) -> bool:
    # Bloqueo por cuenta (identifier) o por IP en la ventana
    by_id = count_recent_failures(db, identifier=identifier)
    by_ip = count_recent_failures(db, ip=ip)
    return by_id >= MAX_FAILED_ATTEMPTS or by_ip >= MAX_FAILED_ATTEMPTS


def issue_tokens(db: Session, user: User) -> dict[str, Any]:
    access = create_access_token(str(user.id), role=user.role.value)
    refresh_value = create_refresh_token_value()
    expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_refresh(refresh_value),
            expires_at=expires,
        )
    )
    return {
        "access_token": access,
        "token_type": "bearer",
        "refresh_token": refresh_value,
        "must_change_credentials": user.must_change_credentials,
    }


def _require_active(user: User) -> None:
    if not user.is_active:
        raise AuthError("Invalid credentials")


def login_student(
    db: Session,
    *,
    course_code: str,
    identifier: str,
    pin: str,
    ip: str | None,
) -> tuple[User, dict[str, Any]]:
    if _is_locked(db, identifier=identifier, ip=ip):
        record_failed_login(db, identifier=identifier, ip=ip, reason="locked")
        db.commit()
        raise AuthError("Too many attempts. Try again later.", status_code=429)

    course = db.scalar(select(Course).where(Course.code == course_code))
    if course is None or course.status is not CourseStatus.active:
        record_failed_login(db, identifier=identifier, ip=ip, reason="unknown_course")
        db.commit()
        raise AuthError("Invalid credentials")

    user = db.scalar(
        select(User).where(
            User.role == UserRole.student,
            (User.username == identifier) | (User.email == identifier) | (User.name == identifier),
        )
    )
    if user is None:
        record_failed_login(db, identifier=identifier, ip=ip, course_id=course.id)
        db.commit()
        raise AuthError("Invalid credentials")

    enrolled = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.student_id == user.id,
        )
    )
    if enrolled is None:
        record_failed_login(db, identifier=identifier, ip=ip, course_id=course.id)
        db.commit()
        raise AuthError("Invalid credentials")

    _require_active(user)
    if not verify_secret(pin, user.pin_hash):
        record_failed_login(db, identifier=identifier, ip=ip, course_id=course.id)
        db.commit()
        raise AuthError("Invalid credentials")

    log_action(
        db,
        action="auth.login_success",
        actor_id=user.id,
        course_id=course.id,
        payload={"role": user.role.value},
        ip=_client_ip(ip),
    )
    tokens = issue_tokens(db, user)
    db.commit()
    db.refresh(user)
    return user, tokens


def login_staff(
    db: Session,
    *,
    email: str,
    password: str,
    ip: str | None,
) -> tuple[User, dict[str, Any]]:
    if _is_locked(db, identifier=email, ip=ip):
        record_failed_login(db, identifier=email, ip=ip, reason="locked")
        db.commit()
        raise AuthError("Too many attempts. Try again later.", status_code=429)

    user = db.scalar(select(User).where(User.email == email))
    if user is None or user.role is UserRole.student:
        record_failed_login(db, identifier=email, ip=ip, reason="unknown_email")
        db.commit()
        raise AuthError("Invalid credentials")

    _require_active(user)
    if not verify_secret(password, user.password_hash):
        record_failed_login(db, identifier=email, ip=ip)
        db.commit()
        raise AuthError("Invalid credentials")

    log_action(
        db,
        action="auth.login_success",
        actor_id=user.id,
        payload={"role": user.role.value},
        ip=_client_ip(ip),
    )
    tokens = issue_tokens(db, user)
    db.commit()
    db.refresh(user)
    return user, tokens


def refresh_tokens(db: Session, *, refresh_token: str) -> tuple[User, dict[str, Any]]:
    token_hash = _hash_refresh(refresh_token)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row is None or row.revoked_at is not None:
        raise AuthError("Invalid refresh token")
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        raise AuthError("Refresh token expired")

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise AuthError("User inactive")

    # Rotación: revocar el actual y emitir uno nuevo
    row.revoked_at = datetime.now(UTC)
    tokens = issue_tokens(db, user)
    db.commit()
    db.refresh(user)
    return user, tokens


def logout(db: Session, *, refresh_token: str | None, user: User | None = None) -> None:
    if refresh_token:
        row = db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == _hash_refresh(refresh_token))
        )
        if row is not None and (user is None or row.user_id == user.id):
            row.revoked_at = datetime.now(UTC)
    elif user is not None:
        now = datetime.now(UTC)
        rows = db.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        for r in rows:
            r.revoked_at = now
    db.commit()


def change_credentials(
    db: Session,
    *,
    user: User,
    current_secret: str,
    new_secret: str,
    ip: str | None = None,
) -> User:
    if user.role is UserRole.student:
        if not verify_secret(current_secret, user.pin_hash):
            raise AuthError("Current credential is invalid", status_code=400)
        # PIN de estudiante: 6+ dígitos para el nuevo también
        if not (new_secret.isdigit() and len(new_secret) >= 6):
            raise AuthError("PIN must be at least 6 digits", status_code=400)
        user.pin_hash = hash_secret(new_secret)
        user.must_change_credentials = False
        log_action(
            db,
            action="auth.pin_changed",
            actor_id=user.id,
            ip=_client_ip(ip),
        )
    else:
        if not verify_secret(current_secret, user.password_hash):
            raise AuthError("Current credential is invalid", status_code=400)
        if len(new_secret) < 8 or new_secret == current_secret:
            raise AuthError("New password too weak", status_code=400)
        user.password_hash = hash_secret(new_secret)
        user.must_change_credentials = False
        log_action(
            db,
            action="auth.password_changed",
            actor_id=user.id,
            ip=_client_ip(ip),
        )
    # Revocar todas las sesiones al cambiar credenciales
    now = datetime.now(UTC)
    for r in db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
    ):
        r.revoked_at = now
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
