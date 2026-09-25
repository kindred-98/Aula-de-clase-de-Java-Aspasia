"""Fases S1 y S2: dashboard y contador de pendientes del alumno."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Assignment, Evaluation, Submission, SubmissionStatus
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


def test_student_dashboard_aggregates(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="s1-profe@aula.test")
    student = make_student(db, name="Ana", username="s1-ana")

    course = make_course(db, code="S1C1")
    assign_teacher(db, course, teacher)
    other_course = make_course(db, code="S1C2")
    assign_teacher(db, other_course, teacher)

    enroll(db, course, student)

    soon = _seed_assignment(
        db, course, teacher, title="Examen parcial", due_at=datetime.now(UTC) + timedelta(days=3)
    )
    later = _seed_assignment(
        db, course, teacher, title="Proyecto final", due_at=datetime.now(UTC) + timedelta(days=10)
    )
    delivered = _seed_assignment(
        db, course, teacher, title="Práctica 1", due_at=datetime.now(UTC) + timedelta(days=1)
    )
    db.add(
        Submission(
            assignment_id=delivered.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
        )
    )
    graded = _seed_assignment(db, course, teacher, title="Quiz")
    submission = Submission(
        assignment_id=graded.id,
        course_id=course.id,
        student_id=student.id,
        status=SubmissionStatus.reviewed,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    db.add(
        Evaluation(
            submission_id=submission.id,
            teacher_id=teacher.id,
            score=Decimal("87.50"),
            comment_markdown="Bien",
        )
    )
    db.commit()

    resp = client.get("/api/v1/student/dashboard", headers=auth_headers(student))
    assert resp.status_code == 200, resp.text
    data = resp.json()

    totals = data["totals"]
    assert totals["courses_count"] == 1
    assert totals["pending_submissions"] == 2
    assert totals["due_this_week"] == 1
    assert totals["graded_submissions"] == 1

    row = data["courses"][0]
    assert row["id"] == course.id
    assert row["pending"] == 2
    assert row["next_due_at"] is not None

    assert [item["assignment_id"] for item in data["upcoming"]] == [soon.id, later.id]
    assert data["upcoming"][0]["course_name"] == "Java"

    assert [item["assignment_id"] for item in data["pending_items"]] == [soon.id, later.id]

    assert len(data["recent"]) == 1
    assert data["recent"][0]["assignment_title"] == "Quiz"
    assert data["recent"][0]["score"] == 87.5


def test_student_dashboard_empty_without_enrollments(client: TestClient, db: Session) -> None:
    student = make_student(db, name="Solo", username="s1-solo")
    resp = client.get("/api/v1/student/dashboard", headers=auth_headers(student))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["totals"]["courses_count"] == 0
    assert data["courses"] == []
    assert data["upcoming"] == []
    assert data["recent"] == []


def test_student_dashboard_isolation_between_students(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="s1-profe2@aula.test")
    ana = make_student(db, name="Ana", username="s1-ana2")
    bol = make_student(db, name="Bol", username="s1-bol")

    course1 = make_course(db, code="S1A1")
    assign_teacher(db, course1, teacher)
    course2 = make_course(db, code="S1A2")
    assign_teacher(db, course2, teacher)

    enroll(db, course1, ana)
    enroll(db, course2, bol)

    ana_data = client.get("/api/v1/student/dashboard", headers=auth_headers(ana)).json()
    assert {c["code"] for c in ana_data["courses"]} == {"S1A1"}

    bol_data = client.get("/api/v1/student/dashboard", headers=auth_headers(bol)).json()
    assert {c["code"] for c in bol_data["courses"]} == {"S1A2"}


def test_student_dashboard_forbidden_for_teacher_and_admin_sees_all(
    client: TestClient, db: Session
) -> None:
    teacher = make_teacher(db, email="s1-profe3@aula.test")
    admin = make_admin(db, email="s1-admin@aula.test")

    denied = client.get("/api/v1/student/dashboard", headers=auth_headers(teacher))
    assert denied.status_code == 403

    make_course(db, code="S1G1")
    make_course(db, code="S1G2")

    resp = client.get("/api/v1/student/dashboard", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    assert {c["code"] for c in resp.json()["courses"]} == {"S1G1", "S1G2"}


def test_student_pending_count(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="s2-profe@aula.test")
    student = make_student(db, name="Ana", username="s2-ana")

    empty = client.get("/api/v1/student/pending-count", headers=auth_headers(student))
    assert empty.status_code == 200, empty.text
    assert empty.json() == {"pending": 0}

    course = make_course(db, code="S2C1")
    assign_teacher(db, course, teacher)
    enroll(db, course, student)

    _seed_assignment(db, course, teacher, title="Sin empezar")
    needs = _seed_assignment(db, course, teacher, title="Rehacer")
    done = _seed_assignment(db, course, teacher, title="Entregada")
    db.add(
        Submission(
            assignment_id=needs.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.needs_changes,
        )
    )
    db.add(
        Submission(
            assignment_id=done.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
        )
    )
    db.commit()

    resp = client.get("/api/v1/student/pending-count", headers=auth_headers(student))
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"pending": 2}

    denied = client.get("/api/v1/student/pending-count", headers=auth_headers(teacher))
    assert denied.status_code == 403


def test_student_dashboard_pending_items_include_overdue_without_date(
    client: TestClient, db: Session
) -> None:
    teacher = make_teacher(db, email="s2-profe2@aula.test")
    student = make_student(db, name="Ana", username="s2-ana2")

    course = make_course(db, code="S2C2")
    assign_teacher(db, course, teacher)
    enroll(db, course, student)

    overdue = _seed_assignment(
        db, course, teacher, title="Atrasada", due_at=datetime.now(UTC) - timedelta(days=1)
    )
    future = _seed_assignment(
        db, course, teacher, title="Futura", due_at=datetime.now(UTC) + timedelta(days=5)
    )
    no_due = _seed_assignment(db, course, teacher, title="Sin fecha")

    data = client.get("/api/v1/student/dashboard", headers=auth_headers(student)).json()

    titles = [item["title"] for item in data["pending_items"]]
    assert titles == ["Atrasada", "Futura", "Sin fecha"]
    assert [item["assignment_id"] for item in data["pending_items"]] == [
        overdue.id,
        future.id,
        no_due.id,
    ]
    assert data["pending_items"][2]["due_at"] is None

    upcoming_ids = [item["assignment_id"] for item in data["upcoming"]]
    assert overdue.id not in upcoming_ids
    assert no_due.id not in upcoming_ids
    assert upcoming_ids == [future.id]
    assert data["totals"]["pending_submissions"] == 3
