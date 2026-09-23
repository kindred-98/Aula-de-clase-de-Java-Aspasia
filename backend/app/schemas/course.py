"""Esquemas de curso, asientos y matrículas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import CourseStatus, EnrollmentStatus


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=2, max_length=16, pattern=r"^[A-Za-z0-9_-]+$")
    description: str | None = None
    layout_rows: int = Field(default=3, ge=1, le=20)
    layout_cols: int = Field(default=5, ge=1, le=20)
    settings: dict[str, Any] = Field(default_factory=dict)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: CourseStatus | None = None
    layout_rows: int | None = Field(default=None, ge=1, le=20)
    layout_cols: int | None = Field(default=None, ge=1, le=20)
    settings: dict[str, Any] | None = None


class CoursePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    code: str
    status: CourseStatus
    layout_rows: int
    layout_cols: int
    settings: dict[str, Any]
    created_at: datetime


class SeatPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    row: int
    col: int


class EnrollmentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    student_id: int
    seat_id: int | None
    status: EnrollmentStatus
    student_name: str | None = None
    student_username: str | None = None
    seat_row: int | None = None
    seat_col: int | None = None


class EnrollmentCreate(BaseModel):
    student_id: int | None = None
    username: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    seat_id: int | None = None


class SeatAssign(BaseModel):
    seat_id: int | None = None


class ClassroomSeat(BaseModel):
    seat_id: int
    row: int
    col: int
    enrollment_id: int | None = None
    student_id: int | None = None
    student_name: str | None = None
    student_username: str | None = None
    status: str | None = None  # delivery summary: none|draft|submitted|reviewed|needs_changes|late


class ClassroomResponse(BaseModel):
    course: CoursePublic
    seats: list[ClassroomSeat]
    rows: int
    cols: int
    teachers: list[dict[str, Any]] = Field(default_factory=list)
