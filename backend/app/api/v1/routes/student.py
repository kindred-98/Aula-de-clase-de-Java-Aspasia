"""Fase S1: dashboard agregado del alumno."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Course,
    Enrollment,
    EnrollmentStatus,
    Evaluation,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)
from app.schemas.student import (
    StudentDashboard,
    StudentDashboardCourse,
    StudentRecentEvaluation,
    StudentTotals,
    StudentUpcomingItem,
)
from app.security.policies import CurrentUser, DbSession

router = APIRouter(prefix="/student", tags=["student"])

UPCOMING_LIMIT = 6
RECENT_LIMIT = 6
DELIVERED_STATUSES = (SubmissionStatus.submitted, SubmissionStatus.reviewed)


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _assert_student(user: User) -> None:
    if user.role not in (UserRole.student, UserRole.admin):
        raise HTTPException(status_code=403, detail="Student access required")


def _my_course_ids(db: Session, user: User) -> list[int]:
    if user.role is UserRole.admin:
        return [int(cid) for cid in db.scalars(select(Course.id).order_by(Course.id)).all()]
    rows = db.scalars(
        select(Enrollment.course_id).where(
            Enrollment.student_id == user.id,
            Enrollment.status == EnrollmentStatus.active,
        )
    ).all()
    return sorted({int(cid) for cid in rows})


@router.get("/dashboard", response_model=StudentDashboard)
def student_dashboard(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> StudentDashboard:
    _assert_student(user)

    course_ids = _my_course_ids(db, user)
    if not course_ids:
        return StudentDashboard(totals=StudentTotals())

    courses = db.scalars(
        select(Course).where(Course.id.in_(course_ids)).order_by(Course.name)
    ).all()
    course_names = {c.id: c.name for c in courses}

    submission_rows = db.execute(
        select(Submission.assignment_id, Submission.status)
        .where(
            Submission.student_id == user.id,
            Submission.course_id.in_(course_ids),
            Submission.assignment_id.is_not(None),
        )
        .order_by(Submission.id.desc())
    ).all()
    status_by_assignment: dict[int, SubmissionStatus] = {}
    for assignment_id, status in submission_rows:
        status_by_assignment.setdefault(int(assignment_id), status)

    now = datetime.now(UTC)
    week_ahead = now + timedelta(days=7)

    assignment_rows = db.execute(
        select(Assignment.id, Assignment.course_id, Assignment.title, Assignment.due_at).where(
            Assignment.course_id.in_(course_ids)
        )
    ).all()

    pending_by_course: dict[int, int] = {}
    next_due_by_course: dict[int, datetime] = {}
    upcoming: list[StudentUpcomingItem] = []
    due_this_week = 0

    for assignment_id, course_id, title, due_at in assignment_rows:
        status = status_by_assignment.get(int(assignment_id))
        if status in DELIVERED_STATUSES:
            continue
        cid = int(course_id)
        pending_by_course[cid] = pending_by_course.get(cid, 0) + 1
        if due_at is None:
            continue
        due = _as_aware(due_at)
        if due < now:
            continue
        if due <= week_ahead:
            due_this_week += 1
        current = next_due_by_course.get(cid)
        if current is None or due < current:
            next_due_by_course[cid] = due
        upcoming.append(
            StudentUpcomingItem(
                course_id=cid,
                course_name=course_names.get(cid, ""),
                assignment_id=int(assignment_id),
                title=title,
                due_at=due,
            )
        )

    upcoming.sort(key=lambda item: item.due_at)
    upcoming = upcoming[:UPCOMING_LIMIT]

    graded = int(
        db.scalar(
            select(func.count())
            .select_from(Submission)
            .where(
                Submission.student_id == user.id,
                Submission.course_id.in_(course_ids),
                Submission.evaluations.any(),
            )
        )
        or 0
    )

    recent_rows = db.execute(
        select(Evaluation, Submission, Course.name, Assignment.title)
        .join(Submission, Evaluation.submission_id == Submission.id)
        .join(Course, Submission.course_id == Course.id)
        .outerjoin(Assignment, Submission.assignment_id == Assignment.id)
        .where(Submission.student_id == user.id)
        .order_by(Evaluation.id.desc())
        .limit(RECENT_LIMIT)
    ).all()

    recent = [
        StudentRecentEvaluation(
            course_id=int(sub.course_id),
            course_name=cname,
            assignment_id=int(sub.assignment_id) if sub.assignment_id is not None else None,
            assignment_title=atitle,
            score=float(ev.score) if ev.score is not None else None,
            evaluated_at=_as_aware(ev.created_at),
        )
        for ev, sub, cname, atitle in recent_rows
    ]

    course_items = [
        StudentDashboardCourse(
            id=c.id,
            name=c.name,
            code=c.code,
            status=str(c.status.value),
            pending=pending_by_course.get(c.id, 0),
            next_due_at=next_due_by_course.get(c.id),
        )
        for c in courses
    ]

    totals = StudentTotals(
        courses_count=len(course_items),
        pending_submissions=sum(pending_by_course.values()),
        due_this_week=due_this_week,
        graded_submissions=graded,
    )

    return StudentDashboard(totals=totals, courses=course_items, upcoming=upcoming, recent=recent)
