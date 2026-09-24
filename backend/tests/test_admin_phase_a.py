"""Tests Fase A: admin dashboard, usuarios, chat y observador."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Assignment, Submission, SubmissionStatus, Visibility
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def test_admin_create_teacher_and_update(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    resp = client.post(
        "/api/v1/admin/users",
        json={
            "name": "Nueva Profe",
            "role": "teacher",
            "email": "profe2@aula.test",
            "password": "Secreta123!",
        },
        headers=auth_headers(admin),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["role"] == "teacher"
    assert data["temporary_secret"]
    assert data["must_change_credentials"] is True
    uid = data["id"]

    patch = client.patch(
        f"/api/v1/admin/users/{uid}",
        json={"name": "Profe Editada", "is_active": False},
        headers=auth_headers(admin),
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == "Profe Editada"
    assert patch.json()["is_active"] is False


def test_admin_create_student_requires_username(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    resp = client.post(
        "/api/v1/admin/users",
        json={"name": "Alumna", "role": "student"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 422

    ok = client.post(
        "/api/v1/admin/users",
        json={"name": "Alumna", "role": "student", "username": "alumna1"},
        headers=auth_headers(admin),
    )
    assert ok.status_code == 201
    assert ok.json()["temporary_secret"] and len(ok.json()["temporary_secret"]) == 6


def test_staff_password_reset(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    teacher = make_teacher(db, email="profe-reset@aula.test")
    resp = client.post(
        f"/api/v1/admin/users/{teacher.id}/reset-password",
        json={},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert len(resp.json()["password"]) >= 8
    assert resp.json()["must_change_credentials"] is True


def test_admin_dashboard_kpis(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="DASH1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db)
    enroll(db, course, student)
    assignment = Assignment(
        course_id=course.id,
        title="T",
        description_markdown="",
        visibility=Visibility.private,
        created_by=teacher.id,
    )
    db.add(assignment)
    db.add(
        Submission(
            assignment_id=assignment.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
            notes="ok",
        )
    )
    db.commit()

    resp = client.get("/api/v1/admin/dashboard", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["courses_total"] >= 1
    assert data["users_total"] >= 3
    assert data["students_total"] >= 1
    assert data["submissions_pending"] >= 1
    assert isinstance(data["recent_audit"], list)


def test_admin_observer_submissions(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="OBS1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="obs1")
    enroll(db, course, student)
    assignment = Assignment(
        course_id=course.id,
        title="Entrega",
        description_markdown="",
        visibility=Visibility.class_,
        created_by=teacher.id,
    )
    db.add(assignment)
    sub = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=student.id,
        status=SubmissionStatus.submitted,
        notes="mi trabajo",
        github_url="https://github.com/u/r",
    )
    db.add(sub)
    db.commit()

    resp = client.get(
        "/api/v1/admin/observer/submissions",
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] >= 1
    row = next(i for i in body["items"] if i["id"] == sub.id)
    assert row["student_name"] == student.name
    assert row["course_code"] == "OBS1"
    assert row["notes"] == "mi trabajo"

    teacher_headers = auth_headers(teacher)
    denied = client.get("/api/v1/admin/observer/submissions", headers=teacher_headers)
    assert denied.status_code == 403


def test_profile_update(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="profile@aula.test")
    resp = client.patch(
        "/api/v1/auth/me",
        json={"name": "Admin Renombrado", "email": "profile2@aula.test"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Admin Renombrado"
    assert resp.json()["email"] == "profile2@aula.test"


def test_messages_admin_student_roundtrip(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    student = make_student(db, username="chat1")
    course = make_course(db, code="CHAT1")
    enroll(db, course, student)

    send = client.post(
        "/api/v1/messages",
        json={"recipient_id": student.id, "body": "Hola, revisa la tarea"},
        headers=auth_headers(admin),
    )
    assert send.status_code == 201, send.text

    student_box = client.get(
        "/api/v1/messages/conversations",
        headers=auth_headers(student),
    )
    assert student_box.status_code == 200
    convs = student_box.json()
    assert any(c["user_id"] == admin.id and c["unread_count"] == 1 for c in convs)

    thread = client.get(
        f"/api/v1/messages/{admin.id}",
        headers=auth_headers(student),
    )
    assert thread.status_code == 200
    assert thread.json()[0]["body"] == "Hola, revisa la tarea"

    mark = client.post(
        f"/api/v1/messages/{admin.id}/read",
        headers=auth_headers(student),
    )
    assert mark.status_code == 204

    reply = client.post(
        "/api/v1/messages",
        json={"recipient_id": admin.id, "body": "OK profe admin"},
        headers=auth_headers(student),
    )
    assert reply.status_code == 201

    admin_box = client.get(
        "/api/v1/messages/conversations",
        headers=auth_headers(admin),
    )
    assert any(c["user_id"] == student.id for c in admin_box.json())


def test_student_cannot_message_random_student(client: TestClient, db: Session) -> None:
    a = make_student(db, username="sente1")
    b = make_student(db, name="Otro", username="sente2")
    resp = client.post(
        "/api/v1/messages",
        json={"recipient_id": b.id, "body": "spam"},
        headers=auth_headers(a),
    )
    assert resp.status_code == 403
