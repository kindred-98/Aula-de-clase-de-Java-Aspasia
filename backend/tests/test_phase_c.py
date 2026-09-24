"""Tests Fase C: multi-dashboard, gradebook, settings, reportes, calendario, backup."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Announcement, Assignment, Evaluation, Submission, SubmissionStatus
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def _seed_assignment(db: Session, course, teacher, **kwargs) -> Assignment:
    due_at = kwargs.get("due_at")
    assignment = Assignment(
        course_id=course.id,
        created_by=teacher.id,
        title=kwargs.get("title", "Tarea 1"),
        description_markdown="",
        max_score=Decimal("100.00"),
        due_at=due_at,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def test_multi_course_dashboard_admin_only(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="md-admin@aula.test")
    teacher = make_teacher(db, email="md-profe@aula.test")
    course = make_course(db, code="MDC1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Ana", username="md-ana")
    enroll(db, course, student)
    assignment = _seed_assignment(db, course, teacher)

    denied = client.get("/api/v1/admin/dashboard/multi", headers=auth_headers(teacher))
    assert denied.status_code == 403

    resp = client.get("/api/v1/admin/dashboard/multi", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["totals"]["courses"] == 1
    assert data["totals"]["enrolled"] == 1
    row = data["courses"][0]
    assert row["course_id"] == course.id
    assert row["assignments"] == 1
    assert row["enrolled"] == 1

    db.add(
        Submission(
            assignment_id=assignment.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
        )
    )
    db.commit()

    again = client.get("/api/v1/admin/dashboard/multi", headers=auth_headers(admin)).json()
    assert again["totals"]["submissions"] == 1
    assert again["totals"]["pending"] == 1


def test_gradebook_matrix_staff(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="gb-profe@aula.test")
    outsider = make_teacher(db, name="Otra", email="gb-otra@aula.test")
    admin = make_admin(db, email="gb-admin@aula.test")
    course = make_course(db, code="GBC1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Ana", username="gb-ana")
    enroll(db, course, student)
    assignment = _seed_assignment(db, course, teacher, title="Examen")

    sub = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=student.id,
        status=SubmissionStatus.reviewed,
    )
    db.add(sub)
    db.flush()
    db.add(
        Evaluation(
            submission_id=sub.id,
            teacher_id=teacher.id,
            score=Decimal("87.50"),
        )
    )
    db.commit()

    denied = client.get(f"/api/v1/courses/{course.id}/gradebook", headers=auth_headers(student))
    assert denied.status_code == 403
    missing = client.get(f"/api/v1/courses/{course.id}/gradebook", headers=auth_headers(outsider))
    assert missing.status_code == 404

    for headers in (auth_headers(teacher), auth_headers(admin)):
        resp = client.get(f"/api/v1/courses/{course.id}/gradebook", headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["columns"][0]["title"] == "Examen"
        assert data["columns"][0]["max_score"] == "100.00"
        row = data["students"][0]
        assert row["student_id"] == student.id
        assert row["cells"][str(assignment.id)]["score"] == "87.50"
        assert row["average"] == "87.5"


def test_center_settings_roundtrip(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="cs-admin@aula.test")
    teacher = make_teacher(db, email="cs-profe@aula.test")

    denied = client.get("/api/v1/admin/settings", headers=auth_headers(teacher))
    assert denied.status_code == 403

    initial = client.get("/api/v1/admin/settings", headers=auth_headers(admin))
    assert initial.status_code == 200
    assert initial.json()["center_name"] == "Aspasia"

    updated = client.put(
        "/api/v1/admin/settings",
        json={"center_name": "IES Aspasia", "max_upload_mb": 25},
        headers=auth_headers(admin),
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["center_name"] == "IES Aspasia"
    assert body["max_upload_mb"] == 25
    assert body["pin_length"] == 6

    again = client.get("/api/v1/admin/settings", headers=auth_headers(admin)).json()
    assert again["center_name"] == "IES Aspasia"

    invalid = client.put(
        "/api/v1/admin/settings",
        json={"default_visibility": "public"},
        headers=auth_headers(admin),
    )
    assert invalid.status_code == 422


def test_reports_overview_and_csv(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="rp-admin@aula.test")
    teacher = make_teacher(db, email="rp-profe@aula.test")
    course = make_course(db, code="RPC1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Ana", username="rp-ana")
    enroll(db, course, student)
    assignment = _seed_assignment(db, course, teacher)
    sub = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=student.id,
        status=SubmissionStatus.reviewed,
    )
    db.add(sub)
    db.flush()
    db.add(Evaluation(submission_id=sub.id, teacher_id=teacher.id, score=Decimal("90")))
    db.commit()

    denied = client.get("/api/v1/admin/reports/overview", headers=auth_headers(teacher))
    assert denied.status_code == 403

    resp = client.get("/api/v1/admin/reports/overview", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["center_name"] == "Aspasia"
    assert data["totals"]["enrolled"] == 1
    assert data["totals"]["reviewed"] == 1
    row = data["courses"][0]
    assert row["avg_score"] == 90.0
    assert row["code"] == "RPC1"

    csv_resp = client.get("/api/v1/admin/reports/overview.csv", headers=auth_headers(admin))
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "report_overview.csv" in csv_resp.headers["content-disposition"]
    text = csv_resp.text
    assert "course_id,name,code" in text
    assert "RPC1" in text


def test_institutional_calendar_visibility(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="ic-admin@aula.test")
    teacher = make_teacher(db, email="ic-profe@aula.test")
    course = make_course(db, code="ICC1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Ana", username="ic-ana")
    outsider = make_student(db, name="Zoe", username="ic-zoe")
    enroll(db, course, student)
    assignment = _seed_assignment(
        db,
        course,
        teacher,
        title="Entrega",
        due_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(
        Announcement(
            course_id=course.id,
            author_id=teacher.id,
            title="Aviso",
            body_markdown="hola",
        )
    )
    db.commit()

    student_items = client.get(
        "/api/v1/calendar/institutional", headers=auth_headers(student)
    ).json()
    kinds = {(i["kind"], i["id"]) for i in student_items}
    assert ("assignment", assignment.id) in kinds
    assert any(k == "announcement" for k, _ in kinds)
    assert all(i["course_id"] == course.id for i in student_items)

    outsider_items = client.get(
        "/api/v1/calendar/institutional", headers=auth_headers(outsider)
    ).json()
    assert outsider_items == []

    admin_items = client.get("/api/v1/calendar/institutional", headers=auth_headers(admin)).json()
    assert any(i["id"] == assignment.id for i in admin_items)


def test_course_backup_json(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="bk-admin@aula.test")
    teacher = make_teacher(db, email="bk-profe@aula.test")
    course = make_course(db, code="BKC1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Ana", username="bk-ana")
    enroll(db, course, student)
    _seed_assignment(db, course, teacher, title="Backup task")
    db.add(
        Announcement(
            course_id=course.id,
            author_id=teacher.id,
            title="Aviso backup",
            body_markdown="x",
        )
    )
    db.commit()

    denied = client.get(f"/api/v1/courses/{course.id}/backup", headers=auth_headers(teacher))
    assert denied.status_code == 403

    missing = client.get("/api/v1/courses/999999/backup", headers=auth_headers(admin))
    assert missing.status_code == 404

    resp = client.get(f"/api/v1/courses/{course.id}/backup", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["course"]["code"] == "BKC1"
    assert data["course"]["layout_rows"] == 3
    assert len(data["seats"]) == 15
    assert data["teachers"][0]["teacher_id"] == teacher.id
    assert (
        data["enrollments"][0]["username"] == "ana"
        or data["enrollments"][0]["student_id"] == student.id
    )
    assert any(a["title"] == "Backup task" for a in data["assignments"])
    assert any(an["title"] == "Aviso backup" for an in data["announcements"])
    assert len(data["submissions"]) == 1 or data["submissions"] == []
