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


class CourseAssignmentStat(BaseModel):
    assignment_id: int
    title: str
    submitted: int = 0
    total: int = 0
    pct: float = 0.0


class CourseStudentStat(BaseModel):
    student_id: int
    name: str
    submitted: int = 0
    pending: int = 0
    last_score: float | None = None
    attendance_pct: float | None = None


class CourseOverview(BaseModel):
    course_id: int
    course_name: str
    assignment_stats: list[CourseAssignmentStat] = []
    student_stats: list[CourseStudentStat] = []


class StudentSubmissionRow(BaseModel):
    submission_id: int
    assignment_id: int | None = None
    assignment_title: str | None = None
    status: str
    submitted_at: datetime | None = None
    score: float | None = None
    evaluated_at: datetime | None = None


class StudentAttendance(BaseModel):
    present: int = 0
    late: int = 0
    absent: int = 0
    excused: int = 0
    pct: float | None = None


class StudentCourseDetail(BaseModel):
    student_id: int
    name: str
    username: str | None = None
    course_id: int
    course_name: str
    submitted: int = 0
    pending: int = 0
    average_score: float | None = None
    attendance: StudentAttendance = StudentAttendance()
    submissions: list[StudentSubmissionRow] = []
