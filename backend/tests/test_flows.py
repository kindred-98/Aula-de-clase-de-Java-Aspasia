"""Tests de flujos principales de la Fase 1 (cobertura de endpoints)."""

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


def test_admin_update_course_and_duplicate_code(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    c1 = make_course(db, code="UPD1")
    resp = client.patch(
        f"/api/v1/courses/{c1.id}",
        json={"name": "Java Avanzado", "status": "archived"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Java Avanzado"
    assert resp.json()["status"] == "archived"

    dup = client.post(
        "/api/v1/courses",
        json={"name": "Otro", "code": "UPD1"},
        headers=auth_headers(admin),
    )
    assert dup.status_code == 409


def test_teacher_course_list_and_classroom(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db)
    other = make_teacher(db, email="other@example.com")
    course = make_course(db, code="CL1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="S", username="scl")
    enroll(db, course, student, seat=next(iter(course.seats)))

    mine = client.get("/api/v1/courses", headers=auth_headers(teacher))
    assert mine.status_code == 200
    assert [c["code"] for c in mine.json()] == ["CL1"]

    theirs = client.get("/api/v1/courses", headers=auth_headers(other))
    assert theirs.json() == []

    room = client.get(f"/api/v1/courses/{course.id}/classroom", headers=auth_headers(teacher))
    assert room.status_code == 200
    body = room.json()
    assert body["rows"] == 3 and body["cols"] == 5
    assert len(body["seats"]) == 15
    occupied = [s for s in body["seats"] if s["student_id"] is not None]
    assert len(occupied) == 1
    assert occupied[0]["status"] == "none"


def test_admin_enrollment_crud_and_teacher_assign(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="ENR1")
    teacher = make_teacher(db)
    student = make_student(db, name="New", username="newone")
    seat = next(iter(course.seats))

    # Asignar profesor
    assert (
        client.post(
            f"/api/v1/courses/{course.id}/teachers/{teacher.id}",
            headers=auth_headers(admin),
        ).status_code
        == 204
    )
    # Ya asignado → 204 idempotente
    assert (
        client.post(
            f"/api/v1/courses/{course.id}/teachers/{teacher.id}",
            headers=auth_headers(admin),
        ).status_code
        == 204
    )
    # Profesor no teacher
    student2 = make_student(db, name="NoT", username="not")
    assert (
        client.post(
            f"/api/v1/courses/{course.id}/teachers/{student2.id}",
            headers=auth_headers(admin),
        ).status_code
        == 404
    )

    # Matricular
    enr = client.post(
        f"/api/v1/courses/{course.id}/enrollments",
        json={"username": "newone", "seat_id": seat.id},
        headers=auth_headers(admin),
    )
    assert enr.status_code == 201, enr.text
    enr_id = enr.json()["id"]

    # Duplicada
    again = client.post(
        f"/api/v1/courses/{course.id}/enrollments",
        json={"username": "newone"},
        headers=auth_headers(admin),
    )
    assert again.status_code == 409

    # Asiento ocupado con otro
    make_student(db, name="Busy", username="busy")
    occupied = client.post(
        f"/api/v1/courses/{course.id}/enrollments",
        json={"username": "busy", "seat_id": seat.id},
        headers=auth_headers(admin),
    )
    assert occupied.status_code == 409

    # Student no existe
    missing = client.post(
        f"/api/v1/courses/{course.id}/enrollments",
        json={"username": "ghost"},
        headers=auth_headers(admin),
    )
    assert missing.status_code == 404

    # Listar
    listing = client.get(f"/api/v1/courses/{course.id}/enrollments", headers=auth_headers(teacher))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    # me
    me = client.get(f"/api/v1/courses/{course.id}/enrollments/me", headers=auth_headers(student))
    assert me.status_code == 200
    assert me.json()["student_username"] == "newone"

    # teacher no enrollment
    tme = client.get(f"/api/v1/courses/{course.id}/enrollments/me", headers=auth_headers(teacher))
    assert tme.status_code == 404

    # Borrar matrícula
    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/enrollments/{enr_id}",
            headers=auth_headers(admin),
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/enrollments/{enr_id}",
            headers=auth_headers(admin),
        ).status_code
        == 404
    )

    # Desasignar profesor
    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/teachers/{teacher.id}",
            headers=auth_headers(admin),
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/teachers/{teacher.id}",
            headers=auth_headers(admin),
        ).status_code
        == 404
    )


def test_submission_full_flow_with_file_and_evaluation(
    client: TestClient, db: Session, tmp_path
) -> None:
    import os

    os.environ["STORAGE_LOCAL_PATH"] = str(tmp_path)
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.core import config as config_mod

    config_mod.settings = get_settings()

    course = make_course(db, code="FLOW2")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Worker", username="worker")
    enroll(db, course, student, seat=next(iter(course.seats)))

    assignment = Assignment(
        course_id=course.id,
        title="Tarea",
        description_markdown="",
        visibility=Visibility.class_,
        created_by=teacher.id,
    )
    db.add(assignment)
    db.commit()

    # Crear entrega
    create = client.post(
        "/api/v1/submissions",
        json={
            "course_id": course.id,
            "assignment_id": assignment.id,
            "github_url": "https://github.com/worker/repo",
            "notes": "primer borrador",
            "submit": True,
        },
        headers=auth_headers(student),
    )
    assert create.status_code == 201, create.text
    sub_id = create.json()["id"]
    assert create.json()["status"] == "submitted"

    # Subir archivo válido
    upload = client.post(
        f"/api/v1/submissions/{sub_id}/files",
        files={"file": ("Main.java", b"class Main { int x = 1; }", "text/x-java-source")},
        headers=auth_headers(student),
    )
    assert upload.status_code == 201, upload.text
    file_id = upload.json()["id"]

    # Download
    dl = client.get(
        f"/api/v1/submissions/{sub_id}/files/{file_id}/download",
        headers=auth_headers(teacher),
    )
    assert dl.status_code == 200
    assert "attachment" in dl.headers["Content-Disposition"]
    assert dl.content == b"class Main { int x = 1; }"

    # List submissions del curso (teacher ve todas)
    listing = client.get(f"/api/v1/courses/{course.id}/submissions", headers=auth_headers(teacher))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    # Evaluar
    ev = client.post(
        f"/api/v1/submissions/{sub_id}/evaluations",
        json={"score": 80, "comment_markdown": "Bien", "rubric_scores": {"tests": 1}},
        headers=auth_headers(teacher),
    )
    assert ev.status_code == 201, ev.text
    assert ev.json()["score"] is not None

    # Dueño ve su evaluación en detail
    detail = client.get(f"/api/v1/submissions/{sub_id}", headers=auth_headers(student))
    assert detail.status_code == 200
    assert detail.json()["latest_evaluation"] is not None

    # Borrar solo drafts
    del_draft = client.delete(f"/api/v1/submissions/{sub_id}", headers=auth_headers(student))
    assert del_draft.status_code == 409

    # Logout
    login = client.post(
        "/api/v1/auth/login/staff",
        json={"email": teacher.email, "password": "teacher-secret-1"},
    )
    assert login.status_code == 200
    rt = login.json()["refresh_token"]
    out = client.post("/api/v1/auth/logout", json={"refresh_token": rt})
    assert out.status_code == 204
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert reuse.status_code == 401

    # Borrar archivo
    assert (
        client.delete(
            f"/api/v1/submissions/{sub_id}/files/{file_id}",
            headers=auth_headers(student),
        ).status_code
        == 204
    )

    get_settings.cache_clear()
    config_mod.settings = get_settings()


def test_assignment_create_and_list(client: TestClient, db: Session) -> None:
    course = make_course(db, code="ASG1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="listst")
    enroll(db, course, student, seat=next(iter(course.seats)))

    created = client.post(
        "/api/v1/assignments",
        json={
            "course_id": course.id,
            "title": "Intro",
            "description_markdown": "hola",
            "visibility": "private",
        },
        headers=auth_headers(teacher),
    )
    assert created.status_code == 201

    # Student no crea tareas
    denied = client.post(
        "/api/v1/assignments",
        json={"course_id": course.id, "title": "x"},
        headers=auth_headers(student),
    )
    assert denied.status_code in (403, 404)

    listing = client.get(f"/api/v1/courses/{course.id}/assignments", headers=auth_headers(student))
    assert listing.status_code == 200
    assert len(listing.json()) == 1


def test_move_seat_to_null_and_invalid(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="MV1")
    make_student(db, username="mvst")
    seat = next(iter(course.seats))
    enr = client.post(
        f"/api/v1/courses/{course.id}/enrollments",
        json={"username": "mvst", "seat_id": seat.id},
        headers=auth_headers(admin),
    )
    assert enr.status_code == 201
    enr_id = enr.json()["id"]

    # seat inválido
    bad = client.patch(
        f"/api/v1/courses/{course.id}/enrollments/{enr_id}/seat",
        json={"seat_id": 99999},
        headers=auth_headers(admin),
    )
    assert bad.status_code == 404

    # liberar asiento
    free = client.patch(
        f"/api/v1/courses/{course.id}/enrollments/{enr_id}/seat",
        json={"seat_id": None},
        headers=auth_headers(admin),
    )
    assert free.status_code == 200
    assert free.json()["seat_id"] is None

    # enrollment inexistente
    missing = client.patch(
        f"/api/v1/courses/{course.id}/enrollments/999/seat",
        json={"seat_id": None},
        headers=auth_headers(admin),
    )
    assert missing.status_code == 404


def test_logout_without_token_and_invalid_refresh(client: TestClient, db: Session) -> None:
    out = client.post("/api/v1/auth/logout", json={})
    assert out.status_code == 204
    bad = client.post("/api/v1/auth/refresh", json={"refresh_token": "nope"})
    assert bad.status_code == 401
    missing = client.post("/api/v1/auth/refresh", json={})
    assert missing.status_code == 401


def test_require_admin_for_non_admin(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db)
    resp = client.post(
        "/api/v1/courses",
        json={"name": "X", "code": "NOADM"},
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 403


def test_invalid_token_and_missing_auth(client: TestClient, db: Session) -> None:
    assert client.get("/api/v1/courses").status_code == 401
    assert client.get("/api/v1/courses", headers={"Authorization": "Bearer bad"}).status_code == 401


def test_submission_github_validation(client: TestClient, db: Session) -> None:
    course = make_course(db, code="GH1")
    student = make_student(db, username="ghst")
    enroll(db, course, student, seat=next(iter(course.seats)))
    bad = client.post(
        "/api/v1/submissions",
        json={
            "course_id": course.id,
            "github_url": "https://gitlab.com/x/y",
            "notes": "",
            "submit": False,
        },
        headers=auth_headers(student),
    )
    assert bad.status_code == 422


def test_evaluation_score_exceeds_max(client: TestClient, db: Session) -> None:
    from decimal import Decimal

    course = make_course(db, code="MAX1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="mxst")
    enroll(db, course, student, seat=next(iter(course.seats)))
    assignment = Assignment(
        course_id=course.id,
        title="Max",
        description_markdown="",
        max_score=Decimal("10.00"),
        created_by=teacher.id,
    )
    db.add(assignment)
    db.commit()
    sub = Submission(
        course_id=course.id,
        assignment_id=assignment.id,
        student_id=student.id,
        status=SubmissionStatus.submitted,
        notes="",
    )
    db.add(sub)
    db.commit()

    resp = client.post(
        f"/api/v1/submissions/{sub.id}/evaluations",
        json={"score": 50, "comment_markdown": "demasiado"},
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 400


def test_submission_not_found_paths(client: TestClient, db: Session) -> None:
    course = make_course(db, code="NF1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="nfst")
    enroll(db, course, student, seat=next(iter(course.seats)))

    assert client.get("/api/v1/submissions/999", headers=auth_headers(student)).status_code == 404
    assert (
        client.post(
            "/api/v1/submissions",
            json={"course_id": course.id, "assignment_id": 999},
            headers=auth_headers(student),
        ).status_code
        == 404
    )
    assert (
        client.patch(
            "/api/v1/submissions/999",
            json={"notes": "x"},
            headers=auth_headers(student),
        ).status_code
        == 404
    )
    assert (
        client.delete("/api/v1/submissions/999", headers=auth_headers(student)).status_code == 404
    )


def test_change_credentials_wrong_current(client: TestClient, db: Session) -> None:
    course = make_course(db, code="CCR")
    student = make_student(db, username="ccst", pin="111111", must_change=True)
    enroll(db, course, student, seat=next(iter(course.seats)))
    login = client.post(
        "/api/v1/auth/login/student",
        json={"course_code": "CCR", "identifier": "ccst", "pin": "111111"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    bad = client.patch(
        "/api/v1/auth/change-credentials",
        json={"current_secret": "222222", "new_secret": "333333"},
        headers=headers,
    )
    assert bad.status_code == 400


def test_course_not_found_generic(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    assert client.get("/api/v1/courses/9999", headers=auth_headers(admin)).status_code == 404
    assert (
        client.patch(
            "/api/v1/courses/9999",
            json={"name": "x"},
            headers=auth_headers(admin),
        ).status_code
        == 404
    )
    assert client.get("/api/v1/courses/9999/seats", headers=auth_headers(admin)).status_code == 404


def test_mine_flag_on_submissions(client: TestClient, db: Session) -> None:
    course = make_course(db, code="MINE1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    a = make_student(db, username="mina")
    b = make_student(db, username="minb")
    seats = list(course.seats)
    enroll(db, course, a, seat=seats[0])
    enroll(db, course, b, seat=seats[1])
    sa = Submission(course_id=course.id, student_id=a.id, notes="a")
    sb = Submission(course_id=course.id, student_id=b.id, notes="b")
    db.add_all([sa, sb])
    db.commit()

    mine = client.get(
        f"/api/v1/courses/{course.id}/submissions?mine=true",
        headers=auth_headers(a),
    )
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["student_id"] == a.id
