"""Esquemas Pydantic."""

from app.schemas.auth import (
    ChangeCredentialsRequest,
    LoginStaffRequest,
    LoginStudentRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserPublic,
)
from app.schemas.common import ErrorDetail, HealthResponse
from app.schemas.course import (
    ClassroomResponse,
    ClassroomSeat,
    CourseCreate,
    CoursePublic,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentPublic,
    SeatAssign,
    SeatPublic,
)
from app.schemas.work import (
    AssignmentCreate,
    AssignmentPublic,
    EvaluationCreate,
    EvaluationPublic,
    SubmissionCreate,
    SubmissionFilePublic,
    SubmissionPublic,
    SubmissionUpdate,
)

__all__ = [
    "AssignmentCreate",
    "AssignmentPublic",
    "ChangeCredentialsRequest",
    "ClassroomResponse",
    "ClassroomSeat",
    "CourseCreate",
    "CoursePublic",
    "CourseUpdate",
    "EnrollmentCreate",
    "EnrollmentPublic",
    "ErrorDetail",
    "EvaluationCreate",
    "EvaluationPublic",
    "HealthResponse",
    "LoginStaffRequest",
    "LoginStudentRequest",
    "LogoutRequest",
    "RefreshRequest",
    "SeatAssign",
    "SeatPublic",
    "SubmissionCreate",
    "SubmissionFilePublic",
    "SubmissionPublic",
    "SubmissionUpdate",
    "TokenResponse",
    "UserPublic",
]
