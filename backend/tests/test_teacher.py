"""Fase T1: dashboard del profesor."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Assignment, Submission, SubmissionStatus
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def _seed_assignment(
    db: Session,
    course,
    teacher,
    *,
    title: str = "Tarea 1",
    due_at: datetime | None = None,
) -> Assignment:
    assignment = Assignment(
        course_id=course.id,
        created_by=teacher.id,
        title=title,
        description_markdown="",
        max_score=Decimal("100.00"),
        due_at=due_at,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def test_teacher_dashboard_aggregates(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="t1-profe@aula.test")
    outsider = make_teacher(db, name="Otra", email="t1-otra@aula.test")
    student = make_student(db, name="Ana", username="t1-ana")

    course = make_course(db, code="T1C1")
    assign_teacher(db, course, teacher)
    other_course = make_course(db, code="T1C2")
    assign_teacher(db, other_course, outsider)

    enroll(db, course, student)
    assignment = _seed_assignment(
        db, course, teacher, title="Examen parcial", due_at=datetime.now(UTC) + timedelta(days=3)
    )
    db.add(
        Submission(
            assignment_id=assignment.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
        )
    )
    db.commit()

    resp = client.get("/api/v1/teacher/dashboard", headers=auth_headers(teacher))
    assert resp.status_code == 200, resp.text
    data = resp.json()

    totals = data["totals"]
    assert totals["courses_count"] == 1
    assert totals["students_count"] == 1
    assert totals["pending_evaluations"] == 1
    assert totals["due_this_week"] == 1
    assert totals["open_assignments"] == 1

    row = data["courses"][0]
    assert row["id"] == course.id
    assert row["students"] == 1
    assert row["pending"] == 1
    assert row["open_assignments"] == 1
    assert row["next_due_at"] is not None

    assert data["upcoming"][0]["assignment_id"] == assignment.id
    assert data["upcoming"][0]["title"] == "Examen parcial"
    assert data["upcoming"][0]["course_name"] == "Java"

    assert len(data["recent"]) == 1
    assert data["recent"][0]["student_name"] == "Ana"
    assert data["recent"][0]["status"] == "submitted"


def test_teacher_dashboard_empty_for_teacher_without_courses(
    client: TestClient, db: Session
) -> None:
    teacher = make_teacher(db, email="t1-empty@aula.test")
    resp = client.get("/api/v1/teacher/dashboard", headers=auth_headers(teacher))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["totals"]["courses_count"] == 0
    assert data["courses"] == []
    assert data["upcoming"] == []
    assert data["recent"] == []


def test_teacher_dashboard_forbidden_for_student_and_admin_sees_all(
    client: TestClient, db: Session
) -> None:
    admin = make_admin(db, email="t1-admin@aula.test")
    teacher = make_teacher(db, email="t1-profe2@aula.test")
    student = make_student(db, name="Bol", username="t1-bol")

    denied = client.get("/api/v1/teacher/dashboard", headers=auth_headers(student))
    assert denied.status_code == 403

    course1 = make_course(db, code="T1A1")
    assign_teacher(db, course1, teacher)
    make_course(db, code="T1A2")

    resp = client.get("/api/v1/teacher/dashboard", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    codes = {c["code"] for c in resp.json()["courses"]}
    assert codes == {"T1A1", "T1A2"}

    profe = client.get("/api/v1/teacher/dashboard", headers=auth_headers(teacher)).json()
    assert {c["code"] for c in profe["courses"]} == {"T1A1"}
