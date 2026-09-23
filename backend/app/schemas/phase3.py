"""Esquemas de rúbricas, asistencia, calendario, clon, export y RGPD."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.activity import AttendanceStatus


class RubricCriterion(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=200)
    max: float = Field(gt=0)


class RubricCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    criteria: list[RubricCriterion] = Field(min_length=1, max_length=50)


class RubricUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    criteria: list[RubricCriterion] | None = Field(default=None, min_length=1, max_length=50)


class RubricPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    criteria: list[dict[str, Any]]
    created_by: int
    created_at: datetime


class AttendanceItem(BaseModel):
    student_id: int
    status: AttendanceStatus


class AttendanceBulkRequest(BaseModel):
    """Pasada de lista: lista de estados para una fecha concreta."""

    date: date
    items: list[AttendanceItem] = Field(min_length=1, max_length=500)


class AttendanceRecordPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    student_id: int
    date: date
    status: AttendanceStatus
    student_name: str | None = None
    student_username: str | None = None
    seat_row: int | None = None
    seat_col: int | None = None


class AttendanceDayResponse(BaseModel):
    date: date
    records: list[AttendanceRecordPublic]


class AttendanceSummaryItem(BaseModel):
    student_id: int
    student_name: str | None
    student_username: str | None
    present: int = 0
    late: int = 0
    absent: int = 0
    excused: int = 0


class CalendarEvent(BaseModel):
    kind: str  # assignment | announcement
    id: int
    title: str
    starts_at: datetime | None = None
    ends_at: datetime | None = None  # due_at de tarea
    body_markdown: str | None = None


class CloneCourseRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=2, max_length=16, pattern=r"^[A-Za-z0-9_-]+$")


class GithubMetaResponse(BaseModel):
    url: str
    full_name: str | None = None
    description: str | None = None
    language: str | None = None
    default_branch: str | None = None
    stars: int | None = None
    pushed_at: str | None = None
    html_url: str | None = None
    cached: bool = False
    ok: bool = True
    error: str | None = None


class RgpdExportResponse(BaseModel):
    user: dict[str, Any]
    enrollments: list[dict[str, Any]]
    submissions: list[dict[str, Any]]
    evaluations: list[dict[str, Any]]
    attendance: list[dict[str, Any]]
    exported_at: datetime
