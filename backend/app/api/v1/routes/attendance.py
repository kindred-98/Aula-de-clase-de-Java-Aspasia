"""Endpoints de asistencia (pasar lista)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AttendanceRecord,
    Course,
    Enrollment,
    EnrollmentStatus,
    Seat,
    User,
)
from app.schemas.phase3 import (
    AttendanceBulkRequest,
    AttendanceDayResponse,
    AttendanceRecordPublic,
    AttendanceSummaryItem,
)
from app.security.policies import DbSession, require_staff_of_course
from app.services.audit import log_action

router = APIRouter(tags=["attendance"])


def _record_public(r: AttendanceRecord, enrollment_seat: Seat | None) -> AttendanceRecordPublic:
    data = AttendanceRecordPublic.model_validate(r)
    if r.student:
        data.student_name = r.student.name
        data.student_username = r.student.username
    if enrollment_seat:
        data.seat_row = enrollment_seat.row
        data.seat_col = enrollment_seat.col
    return data


def _seat_for(db: Session, course_id: int, student_id: int) -> Seat | None:
    enr = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.student_id == student_id,
            Enrollment.status == EnrollmentStatus.active,
        )
    )
    if enr is None or enr.seat_id is None:
        return None
    return db.get(Seat, enr.seat_id)


@router.get("/courses/{course_id}/attendance", response_model=AttendanceDayResponse)
def get_attendance_day(
    course_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
    day: Annotated[date | None, Query(alias="date")] = None,
) -> AttendanceDayResponse:
    _user, course = _staff
    target = day or date.today()
    rows = db.scalars(
        select(AttendanceRecord).where(
            AttendanceRecord.course_id == course.id,
            AttendanceRecord.date == target,
        )
    ).all()
    out = []
    for r in rows:
        seat = _seat_for(db, course.id, r.student_id)
        out.append(_record_public(r, seat))
    return AttendanceDayResponse(date=target, records=out)


@router.put("/courses/{course_id}/attendance", response_model=AttendanceDayResponse)
def upsert_attendance(
    course_id: int,
    body: AttendanceBulkRequest,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
    request: Request,
) -> AttendanceDayResponse:
    user, course = _staff
    enrolled = {
        e.student_id
        for e in db.scalars(
            select(Enrollment).where(
                Enrollment.course_id == course.id,
                Enrollment.status == EnrollmentStatus.active,
            )
        ).all()
    }
    for item in body.items:
        if item.student_id not in enrolled:
            raise HTTPException(status_code=404, detail=f"Student {item.student_id} not enrolled")
        existing = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.course_id == course.id,
                AttendanceRecord.student_id == item.student_id,
                AttendanceRecord.date == body.date,
            )
        )
        if existing is not None:
            existing.status = item.status
        else:
            db.add(
                AttendanceRecord(
                    course_id=course.id,
                    student_id=item.student_id,
                    date=body.date,
                    status=item.status,
                )
            )
    log_action(
        db,
        action="attendance.saved",
        actor_id=user.id,
        entity_type="attendance",
        entity_id=str(body.date),
        course_id=course.id,
        payload={"count": len(body.items)},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    return get_attendance_day(course_id, db, (user, course), body.date)


@router.get(
    "/courses/{course_id}/attendance/summary",
    response_model=list[AttendanceSummaryItem],
)
def attendance_summary(
    course_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> list[AttendanceSummaryItem]:
    _user, course = _staff
    enrollments = db.scalars(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.status == EnrollmentStatus.active,
        )
    ).all()
    records = db.scalars(
        select(AttendanceRecord).where(AttendanceRecord.course_id == course.id)
    ).all()
    by_student: dict[int, dict[str, int]] = {}
    for r in records:
        bucket = by_student.setdefault(
            r.student_id, {"present": 0, "late": 0, "absent": 0, "excused": 0}
        )
        bucket[r.status.value] += 1
    out: list[AttendanceSummaryItem] = []
    for e in enrollments:
        counts = by_student.get(e.student_id, {"present": 0, "late": 0, "absent": 0, "excused": 0})
        out.append(
            AttendanceSummaryItem(
                student_id=e.student_id,
                student_name=e.student.name if e.student else None,
                student_username=e.student.username if e.student else None,
                present=counts["present"],
                late=counts["late"],
                absent=counts["absent"],
                excused=counts["excused"],
            )
        )
    return out
