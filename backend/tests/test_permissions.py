"""Tests de permisos obligatorios (Fase 1) — criterio de aceptación del prompt."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Enrollment,
    Submission,
    SubmissionStatus,
    User,
    Visibility,
)
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def _setup_two_students(db: Session) -> dict[str, Any]:
    course = make_course(db, code="PERM1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    a = make_student(db, name="Ana", username="ana")
    b = make_student(db, name="Beto", username="beto")
    seat_list = list(course.seats)
    enroll(db, course, a, seat=seat_list[0])
    enroll(db, course, b, seat=seat_list[1])
    return {"course": course, "teacher": teacher, "a": a, "b": b}


def test_student_cannot_read_others_submission_detail(client: TestClient, db: Session) -> None:
    """GET /submissions/{id} de un assignment privado: 404 estricto para un peer."""
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    b: User = ctx["b"]
    teacher: User = ctx["teacher"]
    course = ctx["course"]

    assignment = Assignment(
        course_id=course.id,
        title="T1",
        description_markdown="",
        visibility=Visibility.private,
        created_by=teacher.id,
    )
    db.add(assignment)
    db.commit()

    sub = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=a.id,
        status=SubmissionStatus.submitted,
        notes="entrega privada de ana",
    )
    db.add(sub)
    db.commit()

    resp = client.get(f"/api/v1/submissions/{sub.id}", headers=auth_headers(b))
    assert resp.status_code == 404


def test_student_cannot_read_evaluations_of_others(client: TestClient, db: Session) -> None:
    """Cuando SÍ puede ver la entrega (visibility=class), jamás ve evaluaciones ajenas."""
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    b: User = ctx["b"]
    teacher: User = ctx["teacher"]
    course = ctx["course"]

    assignment = Assignment(
        course_id=course.id,
        title="T2",
        description_markdown="",
        visibility=Visibility.class_,
        created_by=teacher.id,
    )
    db.add(assignment)
    db.commit()

    sub = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=a.id,
        status=SubmissionStatus.submitted,
        notes="entrega de ana",
    )
    db.add(sub)
    db.commit()

    resp = client.post(
        f"/api/v1/submissions/{sub.id}/evaluations",
        json={"score": 95, "comment_markdown": "¡excelente!", "rubric_scores": {}},
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 201, resp.text

    # Dueña ve su evaluación
    mine = client.get(
        f"/api/v1/submissions/{sub.id}/evaluations",
        headers=auth_headers(a),
    )
    assert mine.status_code == 200
    assert len(mine.json()) == 1

    # Peer matriculado: la entrega sí es visible (class)…
    detail = client.get(f"/api/v1/submissions/{sub.id}", headers=auth_headers(b))
    assert detail.status_code == 200
    assert detail.json()["notes"] == "entrega de ana"
    # …pero jamás las evaluaciones
    assert detail.json()["latest_evaluation"] is None
    assert detail.json()["evaluations"] == []

    other = client.get(
        f"/api/v1/submissions/{sub.id}/evaluations",
        headers=auth_headers(b),
    )
    assert other.status_code == 200
    assert other.json() == []


def test_student_cannot_read_submission_from_other_course(client: TestClient, db: Session) -> None:
    """Aislamiento entre cursos: inscrito en A, una entrega del curso B → 404."""
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    teacher: User = ctx["teacher"]

    other_course = make_course(db, code="ISO1")
    caro = make_student(db, name="Caro", username="caro")
    enroll(db, other_course, caro, seat=next(iter(other_course.seats)))

    assignment = Assignment(
        course_id=other_course.id,
        title="Deber del curso B",
        description_markdown="",
        visibility=Visibility.class_,
        created_by=teacher.id,
    )
    db.add(assignment)
    db.commit()

    sub = Submission(
        assignment_id=assignment.id,
        course_id=other_course.id,
        student_id=caro.id,
        status=SubmissionStatus.submitted,
        notes="visible solo en curso B",
    )
    db.add(sub)
    db.commit()

    # La dueña (inscrita en B) sí la ve: el 404 de abajo es por el curso, no por otra cosa
    assert (
        client.get(f"/api/v1/submissions/{sub.id}", headers=auth_headers(caro)).status_code == 200
    )
    # `a` está inscrita solo en PERM1 → 404
    resp = client.get(f"/api/v1/submissions/{sub.id}", headers=auth_headers(a))
    assert resp.status_code == 404


def test_student_cannot_write_or_delete_others_submission(client: TestClient, db: Session) -> None:
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    b: User = ctx["b"]
    course = ctx["course"]

    sub = Submission(course_id=course.id, student_id=a.id, notes="solo ana")
    db.add(sub)
    db.commit()

    patch = client.patch(
        f"/api/v1/submissions/{sub.id}",
        json={"notes": "hackeado"},
        headers=auth_headers(b),
    )
    assert patch.status_code == 404

    delete = client.delete(
        f"/api/v1/submissions/{sub.id}",
        headers=auth_headers(b),
    )
    assert delete.status_code == 404


def test_student_cannot_access_course_where_not_enrolled(client: TestClient, db: Session) -> None:
    course = make_course(db, code="CLOSED")
    outsider = make_student(db, name="Eve", username="eve")
    resp = client.get(f"/api/v1/courses/{course.id}/classroom", headers=auth_headers(outsider))
    assert resp.status_code == 404

    resp2 = client.get(f"/api/v1/courses/{course.id}", headers=auth_headers(outsider))
    assert resp2.status_code == 404


def test_teacher_cannot_access_courses_not_theirs(client: TestClient, db: Session) -> None:
    make_course(db, code="OWN")
    course = make_course(db, code="FOREIGN")
    other_teacher = make_teacher(db, email="otra@aula.test", name="Otra")
    # teacher no está en course_teachers
    resp = client.get(
        f"/api/v1/courses/{course.id}/enrollments",
        headers=auth_headers(other_teacher),
    )
    assert resp.status_code == 404

    resp2 = client.get(f"/api/v1/courses/{course.id}", headers=auth_headers(other_teacher))
    assert resp2.status_code == 404


def test_pin_lock_after_failed_attempts(client: TestClient, db: Session) -> None:
    course = make_course(db, code="LOCK1")
    student = make_student(db, name="Lock", username="lockuser", pin="111111")
    enroll(db, course, student, seat=next(iter(course.seats)))

    for _ in range(5):
        r = client.post(
            "/api/v1/auth/login/student",
            json={"course_code": "LOCK1", "identifier": "lockuser", "pin": "999999"},
        )
        assert r.status_code == 401

    # 6º intento (incluso con PIN correcto) → 429
    r = client.post(
        "/api/v1/auth/login/student",
        json={"course_code": "LOCK1", "identifier": "lockuser", "pin": "111111"},
    )
    assert r.status_code == 429


def test_file_upload_rejected_by_extension(client: TestClient, db: Session) -> None:
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    course = ctx["course"]
    sub = Submission(course_id=course.id, student_id=a.id, notes="")
    db.add(sub)
    db.commit()

    resp = client.post(
        f"/api/v1/submissions/{sub.id}/files",
        files={"file": ("evil.exe", b"MZ\x90\x00", "application/octet-stream")},
        headers=auth_headers(a),
    )
    assert resp.status_code in (400, 413)
    assert "extension" in resp.json()["detail"].lower() or "not allowed" in resp.json()["detail"]


def test_file_upload_rejected_by_content_mismatch(client: TestClient, db: Session) -> None:
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    course = ctx["course"]
    sub = Submission(course_id=course.id, student_id=a.id, notes="")
    db.add(sub)
    db.commit()

    # Extensión .png pero contenido no PNG
    resp = client.post(
        f"/api/v1/submissions/{sub.id}/files",
        files={"file": ("fake.png", b"not a real png at all", "image/png")},
        headers=auth_headers(a),
    )
    assert resp.status_code == 400


def test_multi_tenant_isolation_courses(client: TestClient, db: Session) -> None:
    c1 = make_course(db, code="TEN1")
    c2 = make_course(db, code="TEN2")
    s1 = make_student(db, name="S1", username="s1")
    enroll(db, c1, s1, seat=next(iter(c1.seats)))

    # Lista solo ve su curso
    listing = client.get("/api/v1/courses", headers=auth_headers(s1))
    assert listing.status_code == 200
    codes = [c["code"] for c in listing.json()]
    assert codes == ["TEN1"]

    # Classroom de otro curso → 404
    resp = client.get(f"/api/v1/courses/{c2.id}/classroom", headers=auth_headers(s1))
    assert resp.status_code == 404


def test_moving_seat_keeps_submissions_via_api(client: TestClient, db: Session) -> None:
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    course = ctx["course"]
    admin = make_admin(db)

    sub = Submission(course_id=course.id, student_id=a.id, notes="queda")
    db.add(sub)
    db.commit()
    sub_id = sub.id

    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.student_id == a.id,
        )
    )
    assert enrollment is not None
    taken_ids = list(
        db.scalars(
            select(Enrollment.seat_id).where(
                Enrollment.course_id == course.id,
                Enrollment.seat_id.is_not(None),
            )
        ).all()
    )
    free_seat = next(s for s in course.seats if s.id not in taken_ids)
    resp = client.patch(
        f"/api/v1/courses/{course.id}/enrollments/{enrollment.id}/seat",
        json={"seat_id": free_seat.id},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["seat_id"] == free_seat.id

    kept = db.get(Submission, sub_id)
    assert kept is not None
    assert kept.notes == "queda"


def test_student_can_see_peer_submission_when_visibility_class(
    client: TestClient, db: Session
) -> None:
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    b: User = ctx["b"]
    teacher: User = ctx["teacher"]
    course = ctx["course"]

    assignment = Assignment(
        course_id=course.id,
        title="Pair",
        description_markdown="",
        visibility=Visibility.class_,
        created_by=teacher.id,
    )
    db.add(assignment)
    db.commit()
    sub = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=a.id,
        status=SubmissionStatus.submitted,
        notes="visible",
    )
    db.add(sub)
    db.commit()

    detail = client.get(f"/api/v1/submissions/{sub.id}", headers=auth_headers(b))
    assert detail.status_code == 200
    body = detail.json()
    assert body["notes"] == "visible"
    # Pero sin evaluaciones ajenas
    assert body["latest_evaluation"] is None
    assert body["evaluations"] == []


def test_student_login_username_only_and_cannot_change_own_pin(
    client: TestClient, db: Session
) -> None:
    course = make_course(db, code="FLOW1")
    student = make_student(db, name="Flow", username="flow", pin="000000")
    enroll(db, course, student, seat=next(iter(course.seats)))

    login = client.post(
        "/api/v1/auth/login/student",
        json={"course_code": "FLOW1", "identifier": "flow", "pin": "000000"},
    )
    assert login.status_code == 200
    tokens = login.json()
    # Fix 5: el refresh token nunca viaja en el body
    assert "refresh_token" not in tokens
    assert tokens["must_change_credentials"] is False
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Acceso normal con el token
    assert client.get("/api/v1/courses", headers=headers).status_code == 200

    # El nombre público no sirve de identificador (solo username)
    by_name = client.post(
        "/api/v1/auth/login/student",
        json={"course_code": "FLOW1", "identifier": "Flow", "pin": "000000"},
    )
    assert by_name.status_code == 401

    # El student no puede cambiar su propio PIN: lo gestiona el admin/profesor
    change = client.patch(
        "/api/v1/auth/change-credentials",
        json={"current_secret": "000000", "new_secret": "999999"},
        headers=headers,
    )
    assert change.status_code == 403

    # El PIN original sigue intacto
    login2 = client.post(
        "/api/v1/auth/login/student",
        json={"course_code": "FLOW1", "identifier": "flow", "pin": "000000"},
    )
    assert login2.status_code == 200


def test_staff_login_and_refresh_rotation(client: TestClient, db: Session) -> None:
    make_teacher(db, email="rot@aula.test", password="rotate-pass-1")
    login = client.post(
        "/api/v1/auth/login/staff",
        json={"email": "rot@aula.test", "password": "rotate-pass-1"},
    )
    assert login.status_code == 200
    # Fix 5: solo cookie httponly, sin refresh_token en el body
    assert "refresh_token" not in login.json()
    refresh1 = client.cookies.get("refresh_token")
    assert refresh1

    r2 = client.post("/api/v1/auth/refresh", json={})
    assert r2.status_code == 200
    refresh2 = client.cookies.get("refresh_token")
    assert refresh2 and refresh2 != refresh1

    # El refresh viejo ya no sirve (rotación)
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert reuse.status_code == 401


def test_admin_creates_course_and_classroom_layout(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    resp = client.post(
        "/api/v1/courses",
        json={"name": "Java", "code": "NEW1", "layout_rows": 3, "layout_cols": 5},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 201
    course_id = resp.json()["id"]
    seats = client.get(f"/api/v1/courses/{course_id}/seats", headers=auth_headers(admin))
    assert seats.status_code == 200
    assert len(seats.json()) == 15


def test_teacher_can_evaluate_but_student_cannot(client: TestClient, db: Session) -> None:
    ctx = _setup_two_students(db)
    a: User = ctx["a"]
    teacher: User = ctx["teacher"]
    course = ctx["course"]
    sub = Submission(course_id=course.id, student_id=a.id, notes="x")
    db.add(sub)
    db.commit()

    # Student no puede evaluar
    resp = client.post(
        f"/api/v1/submissions/{sub.id}/evaluations",
        json={"score": 50, "comment_markdown": "me autoevaluo"},
        headers=auth_headers(a),
    )
    assert resp.status_code in (403, 404)

    # Teacher sí
    ok = client.post(
        f"/api/v1/submissions/{sub.id}/evaluations",
        json={"score": 50, "comment_markdown": "ok"},
        headers=auth_headers(teacher),
    )
    assert ok.status_code == 201
