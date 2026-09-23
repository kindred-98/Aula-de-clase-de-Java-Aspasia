"""Endpoints de administración: usuarios, PIN, CSV, audit log."""

import csv
import io
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select

from app.core.security import hash_secret
from app.models import AuditLog, Course, Enrollment, User, UserRole
from app.schemas.admin import (
    AdminUserPublic,
    AuditLogPublic,
    CsvImportRequest,
    CsvImportResult,
    PinResetRequest,
    PinResetResponse,
    UserStatusUpdate,
)
from app.security.policies import DbSession, require_admin
from app.services.audit import log_action

router = APIRouter(tags=["admin"])


def _generate_pin() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


@router.get("/admin/users", response_model=list[AdminUserPublic])
def list_users(
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
    role: UserRole | None = None,
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[AdminUserPublic]:
    stmt = select(User).order_by(User.id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            (User.name.ilike(pattern))
            | (User.email.ilike(pattern))
            | (User.username.ilike(pattern))
        )
    rows = db.scalars(stmt.limit(limit)).all()
    return [AdminUserPublic.model_validate(u) for u in rows]


@router.patch("/admin/users/{user_id}/status", response_model=AdminUserPublic)
def set_user_status(
    user_id: int,
    body: UserStatusUpdate,
    db: DbSession,
    admin: Annotated[User, Depends(require_admin)],
    request: Request,
) -> AdminUserPublic:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = body.is_active
    log_action(
        db,
        action="user.status_changed",
        actor_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        payload={"is_active": body.is_active},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(user)
    return AdminUserPublic.model_validate(user)


@router.post("/admin/users/{user_id}/reset-pin", response_model=PinResetResponse)
def reset_pin(
    user_id: int,
    body: PinResetRequest,
    db: DbSession,
    admin: Annotated[User, Depends(require_admin)],
    request: Request,
) -> PinResetResponse:
    user = db.get(User, user_id)
    if user is None or user.role is not UserRole.student:
        raise HTTPException(status_code=404, detail="Student not found")
    pin = body.pin or _generate_pin()
    user.pin_hash = hash_secret(pin)
    user.must_change_credentials = True
    log_action(
        db,
        action="pin.reset",
        actor_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        # Nunca el PIN en claro en el log
        payload={"reason": "admin_reset"},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return PinResetResponse(user_id=user.id, pin=pin, must_change_credentials=True)


@router.post("/admin/courses/{course_id}/import-students", response_model=CsvImportResult)
def import_students_csv(
    course_id: int,
    body: CsvImportRequest,
    db: DbSession,
    admin: Annotated[User, Depends(require_admin)],
    request: Request,
) -> CsvImportResult:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    reader = csv.reader(io.StringIO(body.csv_text))
    created = 0
    skipped = 0
    pins: dict[str, str] = {}

    for row in reader:
        if not row or all(not cell.strip() for cell in row):
            continue
        # cabecera opcional
        if row[0].strip().lower() == "name" and created == 0 and skipped == 0:
            continue
        name = row[0].strip()
        if not name:
            skipped += 1
            continue
        email = row[1].strip() if len(row) > 1 and row[1].strip() else None
        username = row[2].strip() if len(row) > 2 and row[2].strip() else None
        if username is None:
            base = "".join(c.lower() for c in name if c.isalnum()) or "student"
            username = base
            suffix = 1
            while db.scalar(select(User).where(User.username == username)):
                suffix += 1
                username = f"{base}{suffix}"

        existing = db.scalar(select(User).where(User.username == username))
        if existing is not None:
            skipped += 1
            continue

        pin = _generate_pin()
        student = User(
            name=name,
            email=email,
            username=username,
            role=UserRole.student,
            pin_hash=hash_secret(pin),
            is_active=True,
            must_change_credentials=True,
        )
        db.add(student)
        db.flush()
        db.add(Enrollment(course_id=course.id, student_id=student.id))
        pins[username] = pin
        created += 1

    log_action(
        db,
        action="students.imported",
        actor_id=admin.id,
        entity_type="course",
        entity_id=course.id,
        course_id=course.id,
        payload={"created": created, "skipped": skipped},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return CsvImportResult(created=created, skipped=skipped, pins=pins)


@router.get("/admin/audit-logs", response_model=list[AuditLogPublic])
def list_audit_logs(
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
    action: str | None = Query(default=None, max_length=80),
    course_id: int | None = Query(default=None, ge=1),
    actor_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AuditLogPublic]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if course_id is not None:
        stmt = stmt.where(AuditLog.course_id == course_id)
    if actor_id is not None:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    rows = db.scalars(stmt.limit(limit)).all()
    out: list[AuditLogPublic] = []
    for row in rows:
        item = AuditLogPublic.model_validate(row)
        if row.actor_id is not None:
            actor = db.get(User, row.actor_id)
            item.actor_name = actor.name if actor else None
        out.append(item)
    return out


@router.get("/admin/metrics/course/{course_id}")
def course_metrics(
    course_id: int,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
) -> dict[str, int]:
    """Métricas básicas: entregas por estado y matrículas."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    from app.models import Submission, SubmissionStatus

    enrolled = int(
        db.scalar(
            select(func.count()).select_from(Enrollment).where(Enrollment.course_id == course.id)
        )
        or 0
    )
    total_subs = int(
        db.scalar(
            select(func.count()).select_from(Submission).where(Submission.course_id == course.id)
        )
        or 0
    )
    by_status: dict[str, int] = {}
    for status in SubmissionStatus:
        count = int(
            db.scalar(
                select(func.count())
                .select_from(Submission)
                .where(
                    Submission.course_id == course.id,
                    Submission.status == status,
                )
            )
            or 0
        )
        by_status[status.value] = count
    return {
        "enrolled": enrolled,
        "submissions_total": total_subs,
        **{f"submissions_{k}": v for k, v in by_status.items()},
    }
