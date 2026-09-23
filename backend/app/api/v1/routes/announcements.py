"""Endpoints de anuncios del curso."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Announcement, Course, User, UserRole
from app.schemas.content import AnnouncementCreate, AnnouncementPublic, AnnouncementUpdate
from app.security.policies import CurrentUser, DbSession, require_enrolled, require_staff_of_course
from app.services.audit import log_action

router = APIRouter(tags=["announcements"])


def _get_course(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _public(a: Announcement) -> AnnouncementPublic:
    data = AnnouncementPublic.model_validate(a)
    data.author_name = a.author.name if a.author else None
    return data


@router.get("/courses/{course_id}/announcements", response_model=list[AnnouncementPublic])
def list_announcements(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[AnnouncementPublic]:
    course = _get_course(db, course_id)
    require_enrolled(db, user, course)
    rows = db.scalars(
        select(Announcement)
        .where(Announcement.course_id == course.id)
        .order_by(Announcement.created_at.desc())
    ).all()
    return [_public(a) for a in rows]


@router.post(
    "/courses/{course_id}/announcements",
    response_model=AnnouncementPublic,
    status_code=201,
)
def create_announcement(
    course_id: int,
    body: AnnouncementCreate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> AnnouncementPublic:
    user, course = _staff
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Staff access required")
    announcement = Announcement(
        course_id=course.id,
        author_id=user.id,
        title=body.title,
        body_markdown=body.body_markdown,
    )
    db.add(announcement)
    log_action(
        db,
        action="announcement.created",
        actor_id=user.id,
        entity_type="announcement",
        entity_id=announcement.id,
        course_id=course.id,
    )
    db.commit()
    db.refresh(announcement)
    return _public(announcement)


@router.patch(
    "/courses/{course_id}/announcements/{announcement_id}",
    response_model=AnnouncementPublic,
)
def update_announcement(
    course_id: int,
    announcement_id: int,
    body: AnnouncementUpdate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> AnnouncementPublic:
    user, course = _staff
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Staff access required")
    row = db.get(Announcement, announcement_id)
    if row is None or row.course_id != course.id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    log_action(
        db,
        action="announcement.updated",
        actor_id=user.id,
        entity_type="announcement",
        entity_id=row.id,
        course_id=course.id,
    )
    db.commit()
    db.refresh(row)
    return _public(row)


@router.delete("/courses/{course_id}/announcements/{announcement_id}", status_code=204)
def delete_announcement(
    course_id: int,
    announcement_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> None:
    user, course = _staff
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Staff access required")
    row = db.get(Announcement, announcement_id)
    if row is None or row.course_id != course.id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    log_action(
        db,
        action="announcement.deleted",
        actor_id=user.id,
        entity_type="announcement",
        entity_id=row.id,
        course_id=course.id,
    )
    db.delete(row)
    db.commit()
