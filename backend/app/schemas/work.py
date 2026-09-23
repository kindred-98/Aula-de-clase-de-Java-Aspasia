"""Esquemas de entregas, archivos y evaluaciones."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.work import SubmissionStatus, Visibility

GITHUB_URL_PATTERN = (
    r"^https://github\.com/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?/[A-Za-z0-9._-]+/?$"
)


class SubmissionFilePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_name: str
    mime: str
    size_bytes: int
    sha256: str


class EvaluationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submission_id: int
    teacher_id: int
    score: Decimal | None
    rubric_scores: dict[str, Any]
    comment_markdown: str
    created_at: datetime


class SubmissionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int | None
    course_id: int
    student_id: int
    github_url: str | None
    notes: str
    status: SubmissionStatus
    submitted_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime
    files: list[SubmissionFilePublic] = Field(default_factory=list)
    # Solo se rellena cuando el requester puede ver evaluaciones (owner/staff)
    latest_evaluation: EvaluationPublic | None = None
    evaluations: list[EvaluationPublic] = Field(default_factory=list)
    student_name: str | None = None


class SubmissionCreate(BaseModel):
    course_id: int
    assignment_id: int | None = None
    github_url: str | None = Field(default=None, max_length=500, pattern=GITHUB_URL_PATTERN)
    notes: str = ""
    submit: bool = False


class SubmissionUpdate(BaseModel):
    github_url: str | None = Field(default=None, max_length=500, pattern=GITHUB_URL_PATTERN)
    notes: str | None = None
    submit: bool | None = None


class AssignmentCreate(BaseModel):
    course_id: int
    title: str = Field(min_length=1, max_length=200)
    description_markdown: str = ""
    due_at: datetime | None = None
    max_score: Decimal = Field(default=Decimal("100.00"), gt=0)
    visibility: Visibility = Visibility.private
    section_id: int | None = None


class AssignmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    section_id: int | None
    title: str
    description_markdown: str
    due_at: datetime | None
    max_score: Decimal
    visibility: Visibility
    created_by: int
    created_at: datetime


class EvaluationCreate(BaseModel):
    score: Decimal | None = Field(default=None, ge=0)
    comment_markdown: str = ""
    rubric_scores: dict[str, Any] = Field(default_factory=dict)
    mark_status: SubmissionStatus | None = None
