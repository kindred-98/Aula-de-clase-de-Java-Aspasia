"""Políticas de permisos reutilizables."""

from app.security.policies import (
    CurrentCourse,
    CurrentUser,
    DbSession,
    can_read_submission,
    can_write_submission,
    current_user_from_token,
    get_bearer_token,
    get_course_or_404,
    require_admin,
    require_enrolled,
    require_staff_of_course,
    require_teacher_of_course,
)

__all__ = [
    "CurrentCourse",
    "CurrentUser",
    "DbSession",
    "can_read_submission",
    "can_write_submission",
    "current_user_from_token",
    "get_bearer_token",
    "get_course_or_404",
    "require_admin",
    "require_enrolled",
    "require_staff_of_course",
    "require_teacher_of_course",
]
