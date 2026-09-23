"""Registro de auditoría (AuditLog) sin datos sensibles."""

from typing import Any

from sqlalchemy.orm import Session


def log_action(
    db: Session,
    *,
    action: str,
    actor_id: int | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    course_id: int | None = None,
    payload: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    from app.models import AuditLog

    safe_payload = dict(payload or {})
    # Nunca persistir secretos
    for key in ("pin", "password", "token", "secret", "refresh"):
        safe_payload.pop(key, None)
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            course_id=course_id,
            payload=safe_payload,
            ip=ip,
        )
    )
