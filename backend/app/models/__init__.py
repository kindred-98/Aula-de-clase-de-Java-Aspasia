"""Exports de todos los modelos (necesario para Alembic autogenerate)."""

from app.models.activity import Announcement, AttendanceRecord, AttendanceStatus, AuditLog
from app.models.course import (
    Course,
    CourseStatus,
    CourseTeacher,
    Enrollment,
    EnrollmentStatus,
    Seat,
    Section,
    SectionKind,
)
from app.models.user import RefreshToken, User, UserRole
from app.models.work import (
    Assignment,
    Evaluation,
    Submission,
    SubmissionFile,
    SubmissionStatus,
    Visibility,
)

__all__ = [
    "Announcement",
    "Assignment",
    "AttendanceRecord",
    "AttendanceStatus",
    "AuditLog",
    "Course",
    "CourseStatus",
    "CourseTeacher",
    "Enrollment",
    "EnrollmentStatus",
    "Evaluation",
    "RefreshToken",
    "Seat",
    "Section",
    "SectionKind",
    "Submission",
    "SubmissionFile",
    "SubmissionStatus",
    "User",
    "UserRole",
    "Visibility",
]
