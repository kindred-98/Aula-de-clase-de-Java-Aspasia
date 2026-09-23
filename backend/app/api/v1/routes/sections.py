"""Endpoints de secciones del curso (menú dinámico)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Course, Section, User, UserRole
from app.schemas.content import SectionCreate, SectionPublic, SectionUpdate
from app.security.policies import CurrentUser, DbSession, require_enrolled, require_staff_of_course
from app.services.audit import log_action

router = APIRouter(tags=["sections"])


def _get_course(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/courses/{course_id}/sections", response_model=list[SectionPublic])
def list_sections(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[SectionPublic]:
    course = _get_course(db, course_id)
    require_enrolled(db, user, course)
    rows = db.scalars(
        select(Section).where(Section.course_id == course.id).order_by(Section.order, Section.id)
    ).all()
    return [SectionPublic.model_validate(s) for s in rows]


@router.post("/courses/{course_id}/sections", response_model=SectionPublic, status_code=201)
def create_section(
    course_id: int,
    body: SectionCreate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> SectionPublic:
    user, course = _staff
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Staff access required")
    exists = db.scalar(
        select(Section).where(Section.course_id == course.id, Section.slug == body.slug)
    )
    if exists is not None:
        raise HTTPException(status_code=409, detail="Section slug already exists")
    section = Section(
        course_id=course.id,
        title=body.title,
        slug=body.slug,
        order=body.order,
        kind=body.kind,
        body_markdown=body.body_markdown,
        external_url=body.external_url,
    )
    db.add(section)
    log_action(
        db,
        action="section.created",
        actor_id=user.id,
        entity_type="section",
        entity_id=section.id,
        course_id=course.id,
    )
    db.commit()
    db.refresh(section)
    return SectionPublic.model_validate(section)


@router.patch("/courses/{course_id}/sections/{section_id}", response_model=SectionPublic)
def update_section(
    course_id: int,
    section_id: int,
    body: SectionUpdate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> SectionPublic:
    user, course = _staff
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Staff access required")
    section = db.get(Section, section_id)
    if section is None or section.course_id != course.id:
        raise HTTPException(status_code=404, detail="Section not found")
    data = body.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] != section.slug:
        dup = db.scalar(
            select(Section).where(Section.course_id == course.id, Section.slug == data["slug"])
        )
        if dup is not None:
            raise HTTPException(status_code=409, detail="Section slug already exists")
    for key, value in data.items():
        setattr(section, key, value)
    log_action(
        db,
        action="section.updated",
        actor_id=user.id,
        entity_type="section",
        entity_id=section.id,
        course_id=course.id,
    )
    db.commit()
    db.refresh(section)
    return SectionPublic.model_validate(section)


@router.delete("/courses/{course_id}/sections/{section_id}", status_code=204)
def delete_section(
    course_id: int,
    section_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> None:
    user, course = _staff
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Staff access required")
    section = db.get(Section, section_id)
    if section is None or section.course_id != course.id:
        raise HTTPException(status_code=404, detail="Section not found")
    log_action(
        db,
        action="section.deleted",
        actor_id=user.id,
        entity_type="section",
        entity_id=section.id,
        course_id=course.id,
    )
    db.delete(section)
    db.commit()
