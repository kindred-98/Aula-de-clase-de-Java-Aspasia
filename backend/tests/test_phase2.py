"""Tests de Fase 2: secciones, anuncios, tareas con fechas, admin, audit."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import verify_secret
from app.models import User
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def test_section_crud_and_visibility(client: TestClient, db: Session) -> None:
    course = make_course(db, code="SEC1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="secst")
    enroll(db, course, student, seat=next(iter(course.seats)))
    outsider = make_student(db, username="secout")

    created = client.post(
        f"/api/v1/courses/{course.id}/sections",
        json={"title": "HTML", "slug": "html", "order": 1, "body_markdown": "# Hola"},
        headers=auth_headers(teacher),
    )
    assert created.status_code == 201, created.text
    sec_id = created.json()["id"]

    # slug duplicado
    dup = client.post(
        f"/api/v1/courses/{course.id}/sections",
        json={"title": "Otro", "slug": "html"},
        headers=auth_headers(teacher),
    )
    assert dup.status_code == 409

    # student no crea
    denied = client.post(
        f"/api/v1/courses/{course.id}/sections",
        json={"title": "X", "slug": "x"},
        headers=auth_headers(student),
    )
    assert denied.status_code == 403

    # enrolled lee
    listing = client.get(f"/api/v1/courses/{course.id}/sections", headers=auth_headers(student))
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["body_markdown"] == "# Hola"

    # outsider 404
    out = client.get(f"/api/v1/courses/{course.id}/sections", headers=auth_headers(outsider))
    assert out.status_code == 404

    # update
    patched = client.patch(
        f"/api/v1/courses/{course.id}/sections/{sec_id}",
        json={"title": "HTML5", "external_url": "https://example.com"},
        headers=auth_headers(teacher),
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "HTML5"

    # delete
    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/sections/{sec_id}",
            headers=auth_headers(teacher),
        ).status_code
        == 204
    )
    assert (
        client.get(f"/api/v1/courses/{course.id}/sections", headers=auth_headers(student)).json()
        == []
    )


def test_external_section_kind(client: TestClient, db: Session) -> None:
    course = make_course(db, code="SECX")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    resp = client.post(
        f"/api/v1/courses/{course.id}/sections",
        json={
            "title": "Docs",
            "slug": "docs",
            "kind": "external",
            "external_url": "https://docs.example.com",
        },
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 201
    assert resp.json()["kind"] == "external"


def test_announcement_crud(client: TestClient, db: Session) -> None:
    course = make_course(db, code="ANN1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="annst")
    enroll(db, course, student, seat=next(iter(course.seats)))
    outsider = make_student(db, username="annout")

    created = client.post(
        f"/api/v1/courses/{course.id}/announcements",
        json={"title": "Parcial", "body_markdown": "El viernes hay parcial"},
        headers=auth_headers(teacher),
    )
    assert created.status_code == 201, created.text
    ann_id = created.json()["id"]
    assert created.json()["author_name"] == teacher.name

    listing = client.get(
        f"/api/v1/courses/{course.id}/announcements", headers=auth_headers(student)
    )
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    assert (
        client.get(
            f"/api/v1/courses/{course.id}/announcements", headers=auth_headers(outsider)
        ).status_code
        == 404
    )

    patched = client.patch(
        f"/api/v1/courses/{course.id}/announcements/{ann_id}",
        json={"title": "Parcial II"},
        headers=auth_headers(teacher),
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Parcial II"

    denied = client.post(
        f"/api/v1/courses/{course.id}/announcements",
        json={"title": "spam"},
        headers=auth_headers(student),
    )
    assert denied.status_code == 403

    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/announcements/{ann_id}",
            headers=auth_headers(teacher),
        ).status_code
        == 204
    )


def test_assignment_update_delete_and_due_date(client: TestClient, db: Session) -> None:
    course = make_course(db, code="ASG2")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    other = make_teacher(db, email="other2@example.com")

    created = client.post(
        "/api/v1/assignments",
        json={
            "course_id": course.id,
            "title": "Tarea 1",
            "due_at": "2026-10-01T23:59:00Z",
            "visibility": "private",
            "max_score": 50,
        },
        headers=auth_headers(teacher),
    )
    assert created.status_code == 201, created.text
    asg_id = created.json()["id"]
    assert created.json()["due_at"] is not None

    # teacher ajeno no edita
    forbidden = client.patch(
        f"/api/v1/assignments/{asg_id}",
        json={"title": "Hacked"},
        headers=auth_headers(other),
    )
    assert forbidden.status_code == 404

    patched = client.patch(
        f"/api/v1/assignments/{asg_id}",
        json={"visibility": "class", "due_at": "2026-10-05T12:00:00Z"},
        headers=auth_headers(teacher),
    )
    assert patched.status_code == 200
    assert patched.json()["visibility"] == "class"

    detail = client.get(f"/api/v1/assignments/{asg_id}", headers=auth_headers(teacher))
    assert detail.status_code == 200

    assert (
        client.delete(f"/api/v1/assignments/{asg_id}", headers=auth_headers(teacher)).status_code
        == 204
    )
    assert (
        client.get(f"/api/v1/assignments/{asg_id}", headers=auth_headers(teacher)).status_code
        == 404
    )


def test_resubmit_increments_version(client: TestClient, db: Session) -> None:
    course = make_course(db, code="VER1")
    student = make_student(db, username="verst")
    enroll(db, course, student, seat=next(iter(course.seats)))

    create = client.post(
        "/api/v1/submissions",
        json={"course_id": course.id, "notes": "v1", "submit": True},
        headers=auth_headers(student),
    )
    assert create.status_code == 201
    sub_id = create.json()["id"]
    assert create.json()["version"] == 1

    resub = client.patch(
        f"/api/v1/submissions/{sub_id}",
        json={"notes": "v2", "submit": True},
        headers=auth_headers(student),
    )
    assert resub.status_code == 200
    assert resub.json()["version"] == 2
    assert resub.json()["status"] == "submitted"


def test_admin_list_users_and_status(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    student = make_student(db, name="Activa", username="activa")

    users = client.get("/api/v1/admin/users?role=student", headers=auth_headers(admin))
    assert users.status_code == 200
    assert any(u["username"] == "activa" for u in users.json())

    # teacher no admin
    teacher = make_teacher(db, email="noadmin@example.com")
    assert client.get("/api/v1/admin/users", headers=auth_headers(teacher)).status_code == 403

    # desactivar
    patched = client.patch(
        f"/api/v1/admin/users/{student.id}/status",
        json={"is_active": False},
        headers=auth_headers(admin),
    )
    assert patched.status_code == 200
    assert patched.json()["is_active"] is False

    # 404 user inexistente
    assert (
        client.patch(
            "/api/v1/admin/users/99999/status",
            json={"is_active": True},
            headers=auth_headers(admin),
        ).status_code
        == 404
    )


def test_admin_reset_pin_shown_once(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    student = make_student(db, username="resetme", pin="111111")

    resp = client.post(
        f"/api/v1/admin/users/{student.id}/reset-pin",
        json={},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200, resp.text
    pin = resp.json()["pin"]
    assert len(pin) >= 6 and pin.isdigit()
    assert resp.json()["must_change_credentials"] is True

    db.expire_all()
    refreshed = db.get(User, student.id)
    assert refreshed is not None
    assert verify_secret(pin, refreshed.pin_hash)
    assert refreshed.must_change_credentials is True

    # no es estudiante → 404
    teacher = make_teacher(db, email="nostudent@example.com")
    assert (
        client.post(
            f"/api/v1/admin/users/{teacher.id}/reset-pin",
            json={},
            headers=auth_headers(admin),
        ).status_code
        == 404
    )


def test_admin_csv_import_students(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="CSV1")

    csv_body = (
        "name,email,username\nAna,ana@example.com,ana1\nBob,,bob1\nAna,ana@example.com,ana1\n"
    )
    resp = client.post(
        f"/api/v1/courses/{course.id}/import-students".replace("/courses/", "/admin/courses/"),
        json={"csv_text": csv_body},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 2
    assert body["skipped"] == 1
    assert "ana1" in body["pins"]
    assert "bob1" in body["pins"]

    # course inexistente
    assert (
        client.post(
            "/api/v1/admin/courses/9999/import-students",
            json={"csv_text": "name\nX\n"},
            headers=auth_headers(admin),
        ).status_code
        == 404
    )

    # teacher no importa
    teacher = make_teacher(db, email="nocsv@example.com")
    assert (
        client.post(
            f"/api/v1/admin/courses/{course.id}/import-students",
            json={"csv_text": "name\nZ\n"},
            headers=auth_headers(teacher),
        ).status_code
        == 403
    )


def test_admin_audit_logs_with_filters(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="AUD1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)

    # generamos eventos
    client.post(
        f"/api/v1/courses/{course.id}/announcements",
        json={"title": "Hola"},
        headers=auth_headers(teacher),
    )

    logs = client.get("/api/v1/admin/audit-logs", headers=auth_headers(admin))
    assert logs.status_code == 200
    assert len(logs.json()) >= 1

    filtered = client.get(
        f"/api/v1/admin/audit-logs?action=announcement.created&course_id={course.id}",
        headers=auth_headers(admin),
    )
    assert filtered.status_code == 200
    assert all(row["action"] == "announcement.created" for row in filtered.json())

    teacher_denied = client.get("/api/v1/admin/audit-logs", headers=auth_headers(teacher))
    assert teacher_denied.status_code == 403


def test_admin_course_metrics(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="MET1")
    student = make_student(db, username="metst")
    enroll(db, course, student, seat=next(iter(course.seats)))
    client.post(
        "/api/v1/submissions",
        json={"course_id": course.id, "notes": "x", "submit": True},
        headers=auth_headers(student),
    )

    resp = client.get(f"/api/v1/admin/metrics/course/{course.id}", headers=auth_headers(admin))
    assert resp.status_code == 200
    body = resp.json()
    assert body["enrolled"] == 1
    assert body["submissions_total"] == 1
    assert body["submissions_submitted"] == 1

    assert (
        client.get("/api/v1/admin/metrics/course/9999", headers=auth_headers(admin)).status_code
        == 404
    )


def test_section_requires_enrollment_and_teacher(client: TestClient, db: Session) -> None:
    course = make_course(db, code="SEC404")
    teacher = make_teacher(db, email="sec404@example.com")
    # teacher NO asignado
    student = make_student(db, username="sec404st")
    enroll(db, course, student, seat=next(iter(course.seats)))

    denied = client.post(
        f"/api/v1/courses/{course.id}/sections",
        json={"title": "X", "slug": "x"},
        headers=auth_headers(teacher),
    )
    assert denied.status_code == 404

    # course inexistente
    assert (
        client.get("/api/v1/courses/9999/sections", headers=auth_headers(student)).status_code
        == 404
    )
