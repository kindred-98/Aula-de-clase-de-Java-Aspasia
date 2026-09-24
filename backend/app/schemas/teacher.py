"""Esquemas del panel del profesor (Fases T1 a T4)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class TeacherTotals(BaseModel):
    courses_count: int = 0
    students_count: int = 0
    pending_evaluations: int = 0
    due_this_week: int = 0
    open_assignments: int = 0


class TeacherDashboardCourse(BaseModel):
    id: int
    name: str
    code: str
    status: str
    students: int = 0
    pending: int = 0
    open_assignments: int = 0
    next_due_at: datetime | None = None


class TeacherUpcomingItem(BaseModel):
    course_id: int
    course_name: str
    assignment_id: int
    title: str
    due_at: datetime


class TeacherRecentItem(BaseModel):
    course_id: int
    course_name: str
    assignment_title: str | None = None
    student_name: str
    status: str
    submitted_at: datetime | None = None


class TeacherDashboard(BaseModel):
    totals: TeacherTotals = TeacherTotals()
    courses: list[TeacherDashboardCourse] = []
    upcoming: list[TeacherUpcomingItem] = []
    recent: list[TeacherRecentItem] = []


class TeacherQueueItem(BaseModel):
    submission_id: int
    course_id: int
    course_name: str
    assignment_id: int | None = None
    assignment_title: str | None = None
    student_id: int
    student_name: str
    status: str
    submitted_at: datetime | None = None
    due_at: datetime | None = None


class TeacherQueuePage(BaseModel):
    items: list[TeacherQueueItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


class PendingCount(BaseModel):
    pending: int = 0


TeacherQueueStatus = Literal["submitted", "needs_changes"]
