"""Dependencias de autenticación y políticas de permisos reutilizables.

Toda comprobación de acceso (matriz de permisos) vive aquí; los endpoints
solo declaran la dependencia correspondiente.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request, status
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import (
    Course,
    CourseTeacher,
    Enrollment,
    EnrollmentStatus,
    Submission,
    User,
    UserRole,
)

DbSession = Annotated[Session, Depends(get_db)]

__all__ = [
    "CurrentCourse",
    "CurrentUser",
    "DbSession",
    "current_user_from_token",
    "get_bearer_token",
    "get_course_or_404",
    "require_admin",
    "require_enrolled",
    "require_staff_of_course",
    "require_teacher_of_course",
]


def get_bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return auth.removeprefix("Bearer ").strip()


def current_user_from_token(
    db: Session,
    token: str,
    *,
    require_change_ok: bool = True,
) -> User:
    try:
        payload = decode_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    sub = payload.get("sub")
    if not sub or not str(sub).isdigit():
        raise HTTPException(status_code=401, detail="Invalid token subject")
    user = db.get(User, int(sub))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")
    if require_change_ok and user.must_change_credentials:
        raise HTTPException(status_code=403, detail="Must change credentials first")
    return user


def CurrentUser(
    db: DbSession,
    token: Annotated[str, Depends(get_bearer_token)],
) -> User:
    return current_user_from_token(db, token)


def CurrentUserWithPendingChange(
    db: DbSession,
    token: Annotated[str, Depends(get_bearer_token)],
) -> User:
    """Como CurrentUser pero permite `must_change_credentials` (para el endpoint)."""
    return current_user_from_token(db, token, require_change_ok=False)


def require_admin(user: Annotated[User, Depends(CurrentUser)]) -> User:
    if user.role is not UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_course_or_404(
    db: DbSession,
    course_id: Annotated[int, Path(..., ge=1)],
) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        # 404 en vez de 403 para no filtrar existencia ajenas (invariante 3/4)
        raise HTTPException(status_code=404, detail="Course not found")
    return course


CurrentCourse = Annotated[Course, Depends(get_course_or_404)]


def require_staff_of_course(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
    course: CurrentCourse,
) -> tuple[User, Course]:
    """Admin siempre; teacher solo si es de `course_teachers`."""
    if user.role is UserRole.admin:
        return user, course
    if user.role is UserRole.teacher:
        link = db.scalar(
            select(CourseTeacher).where(
                CourseTeacher.course_id == course.id,
                CourseTeacher.teacher_id == user.id,
            )
        )
        if link is None:
            raise HTTPException(status_code=404, detail="Course not found")
        return user, course
    raise HTTPException(status_code=403, detail="Staff access required")


def require_teacher_of_course(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
    course: CurrentCourse,
) -> tuple[User, Course]:
    """Solo teachers asignados (o admin); estudiantes nunca evalúan."""
    if user.role is UserRole.student:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return require_staff_of_course(db, user, course)


def require_enrolled(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
    course: CurrentCourse,
) -> tuple[User, Course, Enrollment | None]:
    """Student: matrícula activa. Teacher/admin del curso: enrollment None."""
    if user.role in (UserRole.admin, UserRole.teacher):
        u, c = require_staff_of_course(db, user, course)
        return u, c, None
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.student_id == user.id,
            Enrollment.status == EnrollmentStatus.active,
        )
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return user, course, enrollment


def can_read_submission(db: Session, user: User, submission: Submission) -> bool:
    """Matriz: dueño, staff del curso, o peer con visibility=class (sin evals)."""
    if user.role is UserRole.admin:
        return True
    if submission.student_id == user.id:
        return True
    if user.role is UserRole.teacher:
        link = db.scalar(
            select(CourseTeacher).where(
                CourseTeacher.course_id == submission.course_id,
                CourseTeacher.teacher_id == user.id,
            )
        )
        return link is not None
    if user.role is UserRole.student:
        enrolled = db.scalar(
            select(Enrollment).where(
                Enrollment.course_id == submission.course_id,
                Enrollment.student_id == user.id,
                Enrollment.status == EnrollmentStatus.active,
            )
        )
        if enrolled is None:
            return False
        if submission.assignment is None:
            return False
        return submission.assignment.visibility.value == "class"
    raise AssertionError("unreachable: closed UserRole set")


def can_write_submission(user: User, submission: Submission) -> bool:
    return user.role is UserRole.student and submission.student_id == user.id
