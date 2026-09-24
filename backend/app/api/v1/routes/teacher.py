"""Fase T1: dashboard agregado del profesor."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Course,
    CourseTeacher,
    Enrollment,
    EnrollmentStatus,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)
from app.schemas.teacher import (
    TeacherDashboard,
    TeacherDashboardCourse,
    TeacherRecentItem,
    TeacherTotals,
    TeacherUpcomingItem,
)
from app.security.policies import CurrentUser, DbSession

router = APIRouter(prefix="/teacher", tags=["teacher"])

PENDING_STATUSES = [SubmissionStatus.submitted, SubmissionStatus.needs_changes]
UPCOMING_LIMIT = 6
RECENT_LIMIT = 6


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _my_course_ids(db: Session, user: User) -> list[int]:
    if user.role is UserRole.admin:
        return [int(cid) for cid in db.scalars(select(Course.id).order_by(Course.id)).all()]
    rows = db.scalars(
        select(CourseTeacher.course_id).where(CourseTeacher.teacher_id == user.id)
    ).all()
    return sorted({int(cid) for cid in rows})


@router.get("/dashboard", response_model=TeacherDashboard)
def teacher_dashboard(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> TeacherDashboard:
    if user.role not in (UserRole.teacher, UserRole.admin):
        raise HTTPException(status_code=403, detail="Teacher access required")

    course_ids = _my_course_ids(db, user)
    if not course_ids:
        return TeacherDashboard(totals=TeacherTotals())

    courses = db.scalars(
        select(Course).where(Course.id.in_(course_ids)).order_by(Course.name)
    ).all()

    students_by_course: dict[int, int] = {
        int(cid): int(cnt)
        for cid, cnt in db.execute(
            select(Enrollment.course_id, func.count())
            .where(
                Enrollment.course_id.in_(course_ids),
                Enrollment.status == EnrollmentStatus.active,
            )
            .group_by(Enrollment.course_id)
        ).all()
        if cid is not None
    }

    pending_by_course: dict[int, int] = {
        int(cid): int(cnt)
        for cid, cnt in db.execute(
            select(Submission.course_id, func.count())
            .where(
                Submission.course_id.in_(course_ids),
                Submission.status.in_(PENDING_STATUSES),
            )
            .group_by(Submission.course_id)
        ).all()
        if cid is not None
    }

    now = datetime.now(UTC)
    week_ahead = now + timedelta(days=7)

    assignment_rows = db.execute(
        select(Assignment.id, Assignment.course_id, Assignment.title, Assignment.due_at).where(
            Assignment.course_id.in_(course_ids)
        )
    ).all()

    open_by_course: dict[int, int] = {}
    upcoming: list[TeacherUpcomingItem] = []
    due_this_week = 0
    next_due_by_course: dict[int, datetime] = {}
    course_names = {c.id: c.name for c in courses}

    for aid, cid, title, due_at in assignment_rows:
        if due_at is None:
            open_by_course[int(cid)] = open_by_course.get(int(cid), 0) + 1
            continue
        due = _as_aware(due_at)
        if due >= now:
            open_by_course[int(cid)] = open_by_course.get(int(cid), 0) + 1
            if now <= due <= week_ahead:
                due_this_week += 1
            current = next_due_by_course.get(int(cid))
            if current is None or due < current:
                next_due_by_course[int(cid)] = due
            upcoming.append(
                TeacherUpcomingItem(
                    course_id=int(cid),
                    course_name=course_names.get(int(cid), ""),
                    assignment_id=int(aid),
                    title=title,
                    due_at=due,
                )
            )

    upcoming.sort(key=lambda item: item.due_at)
    upcoming = upcoming[:UPCOMING_LIMIT]

    recent_rows = db.execute(
        select(Submission, Course.name, Assignment.title, User.name)
        .join(Course, Submission.course_id == Course.id)
        .outerjoin(Assignment, Submission.assignment_id == Assignment.id)
        .join(User, Submission.student_id == User.id)
        .where(Submission.course_id.in_(course_ids))
        .order_by(Submission.id.desc())
        .limit(RECENT_LIMIT)
    ).all()

    recent = [
        TeacherRecentItem(
            course_id=int(sub.course_id),
            course_name=cname,
            assignment_title=atitle,
            student_name=sname,
            status=str(sub.status.value),
            submitted_at=sub.submitted_at,
        )
        for sub, cname, atitle, sname in recent_rows
    ]

    course_items = [
        TeacherDashboardCourse(
            id=c.id,
            name=c.name,
            code=c.code,
            status=str(c.status.value),
            students=students_by_course.get(c.id, 0),
            pending=pending_by_course.get(c.id, 0),
            open_assignments=open_by_course.get(c.id, 0),
            next_due_at=next_due_by_course.get(c.id),
        )
        for c in courses
    ]

    totals = TeacherTotals(
        courses_count=len(course_items),
        students_count=sum(students_by_course.values()),
        pending_evaluations=sum(pending_by_course.values()),
        due_this_week=due_this_week,
        open_assignments=sum(open_by_course.values()),
    )

    return TeacherDashboard(totals=totals, courses=course_items, upcoming=upcoming, recent=recent)
