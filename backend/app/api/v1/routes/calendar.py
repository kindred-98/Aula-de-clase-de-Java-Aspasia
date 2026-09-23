"""Calendario del curso: fechas límite de tareas + anuncios."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.models import Announcement, Assignment, Course, User
from app.schemas.phase3 import CalendarEvent
from app.security.policies import CurrentUser, DbSession, require_enrolled

router = APIRouter(tags=["calendar"])


@router.get("/courses/{course_id}/calendar", response_model=list[CalendarEvent])
def course_calendar(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[CalendarEvent]:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    require_enrolled(db, user, course)

    events: list[CalendarEvent] = []
    assignments = db.scalars(
        select(Assignment)
        .where(Assignment.course_id == course.id, Assignment.due_at.is_not(None))
        .order_by(Assignment.due_at)
    ).all()
    for a in assignments:
        events.append(CalendarEvent(kind="assignment", id=a.id, title=a.title, ends_at=a.due_at))
    announcements = db.scalars(
        select(Announcement)
        .where(Announcement.course_id == course.id)
        .order_by(Announcement.created_at)
        .limit(50)
    ).all()
    for ann in announcements:
        events.append(
            CalendarEvent(
                kind="announcement",
                id=ann.id,
                title=ann.title,
                starts_at=ann.created_at,
                body_markdown=ann.body_markdown,
            )
        )

    def sort_key(e: CalendarEvent) -> str:
        when = e.ends_at or e.starts_at
        return when.isoformat() if when else "9999-12-31"

    return sorted(events, key=sort_key)
