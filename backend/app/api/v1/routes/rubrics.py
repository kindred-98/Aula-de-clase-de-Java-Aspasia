"""Endpoints de rúbricas del curso."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select

from app.models import Course, Rubric, User
from app.schemas.phase3 import RubricCreate, RubricPublic, RubricUpdate
from app.security.policies import DbSession, require_staff_of_course
from app.services.audit import log_action

router = APIRouter(tags=["rubrics"])


@router.get("/courses/{course_id}/rubrics", response_model=list[RubricPublic])
def list_rubrics(
    course_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> list[RubricPublic]:
    _user, course = _staff
    rows = db.scalars(select(Rubric).where(Rubric.course_id == course.id).order_by(Rubric.id)).all()
    return [RubricPublic.model_validate(r) for r in rows]


@router.post("/courses/{course_id}/rubrics", response_model=RubricPublic, status_code=201)
def create_rubric(
    course_id: int,
    body: RubricCreate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
    request: Request,
) -> RubricPublic:
    user, course = _staff
    rubric = Rubric(
        course_id=course.id,
        title=body.title,
        criteria=[c.model_dump() for c in body.criteria],
        created_by=user.id,
    )
    db.add(rubric)
    db.flush()
    log_action(
        db,
        action="rubric.created",
        actor_id=user.id,
        entity_type="rubric",
        entity_id=rubric.id,
        course_id=course.id,
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(rubric)
    return RubricPublic.model_validate(rubric)


@router.patch("/courses/{course_id}/rubrics/{rubric_id}", response_model=RubricPublic)
def update_rubric(
    course_id: int,
    rubric_id: int,
    body: RubricUpdate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
    request: Request,
) -> RubricPublic:
    user, course = _staff
    rubric = db.get(Rubric, rubric_id)
    if rubric is None or rubric.course_id != course.id:
        raise HTTPException(status_code=404, detail="Rubric not found")
    data = body.model_dump(exclude_unset=True)
    if body.criteria is not None:
        data["criteria"] = [c.model_dump() for c in body.criteria]
    for key, value in data.items():
        setattr(rubric, key, value)
    log_action(
        db,
        action="rubric.updated",
        actor_id=user.id,
        entity_type="rubric",
        entity_id=rubric.id,
        course_id=course.id,
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(rubric)
    return RubricPublic.model_validate(rubric)


@router.delete("/courses/{course_id}/rubrics/{rubric_id}", status_code=204)
def delete_rubric(
    course_id: int,
    rubric_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
    request: Request,
) -> None:
    user, course = _staff
    rubric = db.get(Rubric, rubric_id)
    if rubric is None or rubric.course_id != course.id:
        raise HTTPException(status_code=404, detail="Rubric not found")
    log_action(
        db,
        action="rubric.deleted",
        actor_id=user.id,
        entity_type="rubric",
        entity_id=rubric.id,
        course_id=course.id,
        ip=request.client.host if request.client else None,
    )
    db.delete(rubric)
    db.commit()
