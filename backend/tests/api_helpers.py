"""Helpers de datos para tests de Fase 1."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_secret
from app.models import (
    Course,
    CourseStatus,
    CourseTeacher,
    Enrollment,
    Seat,
    User,
    UserRole,
)


def make_admin(db: Session, **kwargs: Any) -> User:
    user = User(
        name=kwargs.get("name", "Admin"),
        email=kwargs.get("email", "admin@aula.test"),
        username=kwargs.get("username"),
        role=UserRole.admin,
        password_hash=hash_secret(kwargs.get("password", "admin-secret-1")),
        is_active=True,
        must_change_credentials=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_teacher(db: Session, **kwargs: Any) -> User:
    user = User(
        name=kwargs.get("name", "Profe"),
        email=kwargs.get("email", "profe@aula.test"),
        role=UserRole.teacher,
        password_hash=hash_secret(kwargs.get("password", "teacher-secret-1")),
        is_active=True,
        must_change_credentials=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_student(
    db: Session,
    *,
    name: str = "Ana",
    username: str = "ana",
    pin: str = "123456",
    must_change: bool = False,
) -> User:
    user = User(
        name=name,
        username=username,
        role=UserRole.student,
        pin_hash=hash_secret(pin),
        is_active=True,
        must_change_credentials=must_change,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_course(db: Session, *, code: str = "JAVA1", rows: int = 3, cols: int = 5) -> Course:
    course = Course(
        name="Java",
        code=code,
        description="Clase de Java",
        status=CourseStatus.active,
        layout_rows=rows,
        layout_cols=cols,
        settings={},
    )
    db.add(course)
    db.flush()
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            db.add(Seat(course_id=course.id, row=r, col=c))
    db.commit()
    db.refresh(course)
    return course


def assign_teacher(db: Session, course: Course, teacher: User) -> None:
    db.add(CourseTeacher(course_id=course.id, teacher_id=teacher.id))
    db.commit()


def enroll(
    db: Session,
    course: Course,
    student: User,
    *,
    seat: Seat | None = None,
) -> Enrollment:
    if seat is None:
        taken_ids = list(
            db.scalars(
                select(Enrollment.seat_id).where(
                    Enrollment.course_id == course.id,
                    Enrollment.seat_id.is_not(None),
                )
            ).all()
        )
        seats = db.scalars(select(Seat).where(Seat.course_id == course.id)).all()
        free = next(s for s in seats if s.id not in taken_ids)
        seat = free
    enrollment = Enrollment(
        course_id=course.id,
        student_id=student.id,
        seat_id=seat.id,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), role=user.role.value)
    return {"Authorization": f"Bearer {token}"}
