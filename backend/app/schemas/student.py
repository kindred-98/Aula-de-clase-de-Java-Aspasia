"""Esquemas del panel del alumno (Fases S1 a S3)."""

from datetime import datetime

from pydantic import BaseModel


class StudentTotals(BaseModel):
    courses_count: int = 0
    pending_submissions: int = 0
    due_this_week: int = 0
    graded_submissions: int = 0


class StudentDashboardCourse(BaseModel):
    id: int
    name: str
    code: str
    status: str
    pending: int = 0
    next_due_at: datetime | None = None


class StudentUpcomingItem(BaseModel):
    course_id: int
    course_name: str
    assignment_id: int
    title: str
    due_at: datetime


class StudentRecentEvaluation(BaseModel):
    course_id: int
    course_name: str
    assignment_id: int | None = None
    assignment_title: str | None = None
    score: float | None = None
    evaluated_at: datetime | None = None


class StudentDashboard(BaseModel):
    totals: StudentTotals = StudentTotals()
    courses: list[StudentDashboardCourse] = []
    upcoming: list[StudentUpcomingItem] = []
    recent: list[StudentRecentEvaluation] = []
