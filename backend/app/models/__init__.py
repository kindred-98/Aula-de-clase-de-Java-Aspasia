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
from app.models.course_message import CourseMessage, CourseMessageRead
from app.models.message import Message
from app.models.scale import Cohort, CohortMembership, CourseCategory, CustomRole
from app.models.system import SystemSetting
from app.models.user import RefreshToken, User, UserRole
from app.models.work import (
    Assignment,
    Evaluation,
    Rubric,
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
    "Cohort",
    "CohortMembership",
    "Course",
    "CourseCategory",
    "CourseMessage",
    "CourseMessageRead",
    "CourseStatus",
    "CourseTeacher",
    "CustomRole",
    "Enrollment",
    "EnrollmentStatus",
    "Evaluation",
    "Message",
    "RefreshToken",
    "Rubric",
    "Seat",
    "Section",
    "SectionKind",
    "Submission",
    "SubmissionFile",
    "SubmissionStatus",
    "SystemSetting",
    "User",
    "UserRole",
    "Visibility",
]
