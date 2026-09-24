"""Esquemas de Fase C: gradebook, settings, reportes, calendario, backup."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MultiCourseRow(BaseModel):
    course_id: int
    name: str
    code: str
    status: str
    enrolled: int
    assignments: int
    submissions_total: int
    submissions_pending: int
    completion_rate: float = 0.0


class MultiCourseDashboard(BaseModel):
    totals: dict[str, int] = Field(default_factory=dict)
    courses: list[MultiCourseRow] = Field(default_factory=list)


class GradebookCell(BaseModel):
    assignment_id: int | None
    status: str | None = None
    score: str | None = None


class GradebookStudent(BaseModel):
    student_id: int
    name: str
    username: str | None = None
    cells: dict[str, GradebookCell] = Field(default_factory=dict)
    average: str | None = None


class GradebookColumn(BaseModel):
    assignment_id: int
    title: str
    max_score: str


class GradebookMatrix(BaseModel):
    course_id: int
    course_name: str
    columns: list[GradebookColumn] = Field(default_factory=list)
    students: list[GradebookStudent] = Field(default_factory=list)


class CenterSettings(BaseModel):
    center_name: str = "Aspasia"
    support_email: str | None = None
    default_visibility: str = "private"
    allow_peer_submissions: bool = False
    pin_length: int = Field(default=6, ge=4, le=12)
    max_upload_mb: int = Field(default=10, ge=1, le=100)
    terms_markdown: str = ""


class CenterSettingsUpdate(BaseModel):
    center_name: str | None = Field(default=None, min_length=1, max_length=120)
    support_email: str | None = Field(default=None, max_length=320)
    default_visibility: str | None = Field(default=None, pattern="^(private|class)$")
    allow_peer_submissions: bool | None = None
    pin_length: int | None = Field(default=None, ge=4, le=12)
    max_upload_mb: int | None = Field(default=None, ge=1, le=100)
    terms_markdown: str | None = Field(default=None, max_length=20000)


class ReportCourseRow(BaseModel):
    course_id: int
    name: str
    code: str
    status: str
    enrolled: int
    assignments: int
    submissions: int
    reviewed: int
    avg_score: float | None = None
    attendance_present: int = 0
    attendance_absent: int = 0


class ReportOverview(BaseModel):
    generated_at: datetime
    center_name: str
    totals: dict[str, int] = Field(default_factory=dict)
    courses: list[ReportCourseRow] = Field(default_factory=list)


class InstitutionalCalendarItem(BaseModel):
    kind: str
    id: int
    title: str
    course_id: int
    course_name: str
    course_code: str
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class CourseBackup(BaseModel):
    exported_at: datetime
    course: dict[str, Any]
    seats: list[dict[str, Any]] = Field(default_factory=list)
    teachers: list[dict[str, Any]] = Field(default_factory=list)
    enrollments: list[dict[str, Any]] = Field(default_factory=list)
    sections: list[dict[str, Any]] = Field(default_factory=list)
    rubrics: list[dict[str, Any]] = Field(default_factory=list)
    assignments: list[dict[str, Any]] = Field(default_factory=list)
    announcements: list[dict[str, Any]] = Field(default_factory=list)
    submissions: list[dict[str, Any]] = Field(default_factory=list)


class AttendanceReportDay(BaseModel):
    date: date
    present: int = 0
    late: int = 0
    absent: int = 0
    excused: int = 0


class SettingsAuditPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: dict[str, Any]
    updated_at: datetime
