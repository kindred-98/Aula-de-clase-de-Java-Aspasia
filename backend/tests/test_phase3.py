"""Tests de Fase 3: rúbricas, asistencia, calendario, clon, export, RGPD, GitHub."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Submission, SubmissionStatus
from app.services.github_meta import clear_cache, parse_github_url
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def test_rubric_crud_and_assignment_link(client: TestClient, db: Session) -> None:
    course = make_course(db, code="RUB1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="rubst")
    enroll(db, course, student, seat=next(iter(course.seats)))

    created = client.post(
        f"/api/v1/courses/{course.id}/rubrics",
        json={
            "title": "Java base",
            "criteria": [
                {"id": "correct", "label": "Correctitud", "max": 40},
                {"id": "style", "label": "Estilo", "max": 30},
            ],
        },
        headers=auth_headers(teacher),
    )
    assert created.status_code == 201, created.text
    rubric_id = created.json()["id"]
    assert created.json()["criteria"][0]["max"] == 40

    denied = client.post(
        f"/api/v1/courses/{course.id}/rubrics",
        json={"title": "X", "criteria": [{"id": "a", "label": "A", "max": 10}]},
        headers=auth_headers(student),
    )
    assert denied.status_code == 403

    listing = client.get(f"/api/v1/courses/{course.id}/rubrics", headers=auth_headers(teacher))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    asg = client.post(
        "/api/v1/assignments",
        json={
            "course_id": course.id,
            "title": "Tarea con rúbrica",
            "rubric_id": rubric_id,
        },
        headers=auth_headers(teacher),
    )
    assert asg.status_code == 201, asg.text
    assert asg.json()["rubric_id"] == rubric_id

    patched = client.patch(
        f"/api/v1/courses/{course.id}/rubrics/{rubric_id}",
        json={"title": "Java base v2"},
        headers=auth_headers(teacher),
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Java base v2"

    assert (
        client.delete(
            f"/api/v1/courses/{course.id}/rubrics/{rubric_id}",
            headers=auth_headers(teacher),
        ).status_code
        == 204
    )


def test_attendance_upsert_and_summary(client: TestClient, db: Session) -> None:
    course = make_course(db, code="ATT1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    s1 = make_student(db, username="att1")
    s2 = make_student(db, username="att2")
    enroll(db, course, s1, seat=next(iter(course.seats)))
    seats = list(course.seats)
    enroll(db, course, s2, seat=seats[1])
    outsider = make_student(db, username="attout")

    day = date.today().isoformat()
    put = client.put(
        f"/api/v1/courses/{course.id}/attendance",
        json={
            "date": day,
            "items": [
                {"student_id": s1.id, "status": "present"},
                {"student_id": s2.id, "status": "late"},
            ],
        },
        headers=auth_headers(teacher),
    )
    assert put.status_code == 200, put.text
    assert len(put.json()["records"]) == 2

    # re-save updates status
    put2 = client.put(
        f"/api/v1/courses/{course.id}/attendance",
        json={"date": day, "items": [{"student_id": s1.id, "status": "absent"}]},
        headers=auth_headers(teacher),
    )
    assert put2.status_code == 200
    statuses = {r["student_id"]: r["status"] for r in put2.json()["records"]}
    assert statuses[s1.id] == "absent"

    summary = client.get(
        f"/api/v1/courses/{course.id}/attendance/summary",
        headers=auth_headers(teacher),
    )
    assert summary.status_code == 200
    by_id = {row["student_id"]: row for row in summary.json()}
    assert by_id[s1.id]["absent"] == 1
    assert by_id[s2.id]["late"] == 1

    denied = client.put(
        f"/api/v1/courses/{course.id}/attendance",
        json={"date": day, "items": [{"student_id": s1.id, "status": "present"}]},
        headers=auth_headers(outsider),
    )
    assert denied.status_code in (403, 404)

    student_view = client.get(
        f"/api/v1/courses/{course.id}/attendance",
        headers=auth_headers(s1),
    )
    assert student_view.status_code == 403


def test_calendar_events(client: TestClient, db: Session) -> None:
    course = make_course(db, code="CAL1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="calst")
    enroll(db, course, student, seat=next(iter(course.seats)))

    due = datetime.now(UTC) + timedelta(days=3)
    client.post(
        "/api/v1/assignments",
        json={
            "course_id": course.id,
            "title": "Entrega final",
            "due_at": due.isoformat(),
        },
        headers=auth_headers(teacher),
    )
    client.post(
        f"/api/v1/courses/{course.id}/announcements",
        json={"title": "Aviso", "body_markdown": "Hola"},
        headers=auth_headers(teacher),
    )

    cal = client.get(f"/api/v1/courses/{course.id}/calendar", headers=auth_headers(student))
    assert cal.status_code == 200
    kinds = {e["kind"] for e in cal.json()}
    assert "assignment" in kinds
    assert "announcement" in kinds
    assignment_events = [e for e in cal.json() if e["kind"] == "assignment"]
    assert assignment_events[0]["ends_at"] is not None


def test_clone_course_as_template(client: TestClient, db: Session) -> None:
    admin = make_admin(db)
    course = make_course(db, code="CLN1", rows=2, cols=2)
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    client.post(
        f"/api/v1/courses/{course.id}/sections",
        json={"title": "Intro", "slug": "intro", "body_markdown": "# x"},
        headers=auth_headers(teacher),
    )
    client.post(
        "/api/v1/assignments",
        json={"course_id": course.id, "title": "T1"},
        headers=auth_headers(teacher),
    )

    # student cannot clone
    student = make_student(db, username="clnst")
    denied = client.post(
        f"/api/v1/courses/{course.id}/clone",
        json={"name": "Nope", "code": "NOPE1"},
        headers=auth_headers(student),
    )
    assert denied.status_code in (403, 404)

    resp = client.post(
        f"/api/v1/courses/{course.id}/clone",
        json={"name": "Java 2027", "code": "CLN2"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 201, resp.text
    new_id = resp.json()["id"]
    assert resp.json()["code"] == "CLN2"
    assert resp.json()["layout_rows"] == 2

    sections = client.get(f"/api/v1/courses/{new_id}/sections", headers=auth_headers(admin))
    assert sections.status_code == 200
    assert any(s["slug"] == "intro" for s in sections.json())

    assignments = client.get(f"/api/v1/courses/{new_id}/assignments", headers=auth_headers(admin))
    assert assignments.status_code == 200
    assert any(a["title"] == "T1" for a in assignments.json())

    # conflict on same code
    conflict = client.post(
        f"/api/v1/courses/{course.id}/clone",
        json={"name": "Dup", "code": "CLN2"},
        headers=auth_headers(admin),
    )
    assert conflict.status_code == 409


def test_export_grades_csv(client: TestClient, db: Session) -> None:
    course = make_course(db, code="EXP1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="expst", name="Export Student")
    enroll(db, course, student, seat=next(iter(course.seats)))

    asg = client.post(
        "/api/v1/assignments",
        json={"course_id": course.id, "title": "A1"},
        headers=auth_headers(teacher),
    ).json()
    sub = Submission(
        assignment_id=asg["id"],
        course_id=course.id,
        student_id=student.id,
        github_url="https://github.com/foo/bar",
        notes="n",
        status=SubmissionStatus.submitted,
        submitted_at=datetime.now(UTC),
    )
    db.add(sub)
    db.commit()

    resp = client.get(
        f"/api/v1/courses/{course.id}/export/grades.csv",
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    body = resp.text
    assert "student_id" in body
    assert "Export Student" in body
    assert "A1" in body

    student_denied = client.get(
        f"/api/v1/courses/{course.id}/export/grades.csv",
        headers=auth_headers(student),
    )
    assert student_denied.status_code == 403


def test_github_meta_endpoint_and_parser() -> None:
    assert parse_github_url("https://github.com/foo/bar") == ("foo", "bar")
    assert parse_github_url("https://github.com/foo/bar.git") == ("foo", "bar")
    assert parse_github_url("https://gitlab.com/foo/bar") is None
    clear_cache()


def test_github_meta_requires_url(client: TestClient, db: Session) -> None:
    course = make_course(db, code="GHT1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="ghtst")
    enroll(db, course, student, seat=next(iter(course.seats)))
    sub = Submission(
        course_id=course.id,
        student_id=student.id,
        github_url=None,
        notes="",
        status=SubmissionStatus.draft,
    )
    db.add(sub)
    db.commit()
    resp = client.get(
        f"/api/v1/submissions/{sub.id}/github-meta",
        headers=auth_headers(student),
    )
    assert resp.status_code == 404


def test_github_meta_invalid_url_degrades(client: TestClient, db: Session) -> None:
    course = make_course(db, code="GHT2")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="ghtst2")
    enroll(db, course, student, seat=next(iter(course.seats)))
    sub = Submission(
        course_id=course.id,
        student_id=student.id,
        github_url="https://github.com/valid/repo",
        notes="",
        status=SubmissionStatus.draft,
    )
    db.add(sub)
    db.commit()
    # Parser accepts valid shape; network may fail → ok false or ok true, never 500
    resp = client.get(
        f"/api/v1/submissions/{sub.id}/github-meta",
        headers=auth_headers(student),
    )
    assert resp.status_code == 200
    assert "ok" in resp.json()
    clear_cache()


def test_rgpd_export_and_erase(client: TestClient, db: Session) -> None:
    course = make_course(db, code="RG1")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    student = make_student(db, username="rgst", name="RGPD Student")
    enroll(db, course, student, seat=next(iter(course.seats)))
    sub = Submission(
        course_id=course.id,
        student_id=student.id,
        github_url="https://github.com/foo/bar",
        notes="secret notes",
        status=SubmissionStatus.submitted,
    )
    db.add(sub)
    db.commit()

    export = client.get("/api/v1/me/export", headers=auth_headers(student))
    assert export.status_code == 200
    data = export.json()
    assert data["user"]["username"] == "rgst"
    assert any(s["notes"] == "secret notes" for s in data["submissions"])
    assert len(data["enrollments"]) == 1

    teacher_export = client.get("/api/v1/me/export", headers=auth_headers(teacher))
    assert teacher_export.status_code == 200

    erase = client.delete("/api/v1/me/data", headers=auth_headers(student))
    assert erase.status_code == 204

    db.refresh(student)
    assert student.is_active is False
    assert student.name.startswith("[ELIMINADO")
    assert student.username != "rgst"
    db.refresh(sub)
    assert sub.notes == ""
    assert sub.github_url is None

    # teacher cannot self-erase
    t_erase = client.delete("/api/v1/me/data", headers=auth_headers(teacher))
    assert t_erase.status_code == 403

    # admin erase
    admin = make_admin(db, email="rgpd-admin@aula.test")
    other = make_student(db, username="rgother", name="Other")
    resp = client.delete(f"/api/v1/admin/users/{other.id}/data", headers=auth_headers(admin))
    assert resp.status_code == 204
    db.refresh(other)
    assert other.is_active is False
    assert other.name.startswith("[ELIMINADO")

    # cannot erase self via admin
    self_del = client.delete(f"/api/v1/admin/users/{admin.id}/data", headers=auth_headers(admin))
    assert self_del.status_code == 400


def test_attendance_not_enrolled_404(client: TestClient, db: Session) -> None:
    course = make_course(db, code="ATT9")
    teacher = make_teacher(db)
    assign_teacher(db, course, teacher)
    outsider = make_student(db, username="attnoe")
    resp = client.put(
        f"/api/v1/courses/{course.id}/attendance",
        json={
            "date": date.today().isoformat(),
            "items": [{"student_id": outsider.id, "status": "present"}],
        },
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 404


def test_rubric_foreign_course_404(client: TestClient, db: Session) -> None:
    course_a = make_course(db, code="RAA")
    course_b = make_course(db, code="RBB")
    teacher = make_teacher(db)
    assign_teacher(db, course_a, teacher)
    assign_teacher(db, course_b, teacher)
    rub = client.post(
        f"/api/v1/courses/{course_a.id}/rubrics",
        json={"title": "Only A", "criteria": [{"id": "c", "label": "C", "max": 10}]},
        headers=auth_headers(teacher),
    ).json()
    resp = client.patch(
        f"/api/v1/courses/{course_b.id}/rubrics/{rub['id']}",
        json={"title": "Hacked"},
        headers=auth_headers(teacher),
    )
    assert resp.status_code == 404
    # assignment link must be same course
    bad = client.post(
        "/api/v1/assignments",
        json={"course_id": course_b.id, "title": "X", "rubric_id": rub["id"]},
        headers=auth_headers(teacher),
    )
    assert bad.status_code == 404
