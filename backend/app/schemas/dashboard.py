"""Esquemas del dashboard y observador de aula (admin)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AdminDashboardStats(BaseModel):
    courses_total: int
    courses_active: int
    users_total: int
    students_total: int
    teachers_total: int
    enrollments_total: int
    submissions_pending: int
    submissions_total: int
    recent_audit: list[dict[str, Any]] = Field(default_factory=list)
    recent_submissions: list[dict[str, Any]] = Field(default_factory=list)


class ObserverSubmissionRow(BaseModel):
    id: int
    course_id: int
    course_name: str
    course_code: str
    student_id: int
    student_name: str | None
    student_username: str | None
    assignment_id: int | None
    assignment_title: str | None
    status: str
    version: int
    github_url: str | None
    notes: str
    submitted_at: datetime | None
    updated_at: datetime
    file_count: int
    files: list[dict[str, Any]] = Field(default_factory=list)
    latest_score: str | None = None
    latest_comment: str | None = None
    evaluated_at: datetime | None = None


class ObserverResponse(BaseModel):
    total: int
    items: list[ObserverSubmissionRow]
