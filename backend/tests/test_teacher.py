"""Fase T1: dashboard del profesor. Fase T2: cola. Fase T3: panel de curso y ficha."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    AttendanceRecord,
    AttendanceStatus,
    Evaluation,
    Submission,
    SubmissionStatus,
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


def test_queue_multi_course_and_filters(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="t2-profe@aula.test")
    outsider = make_teacher(db, name="Otra", email="t2-otra@aula.test")
    ana = make_student(db, name="Ana", username="t2-ana")
    bol = make_student(db, name="Bol", username="t2-bol")

    course1 = make_course(db, code="T2C1")
    assign_teacher(db, course1, teacher)
    course2 = make_course(db, code="T2C2")
    assign_teacher(db, course2, teacher)
    course3 = make_course(db, code="T2C3")
    assign_teacher(db, course3, outsider)

    enroll(db, course1, ana)
    enroll(db, course2, bol)
    enroll(db, course3, make_student(db, name="Ajeno", username="t2-aj"))

    a1 = _seed_assignment(db, course1, teacher, title="Tarea A", due_at=None)
    a2 = _seed_assignment(db, course2, teacher, title="Tarea B", due_at=None)

    sub1 = Submission(
        assignment_id=a1.id,
        course_id=course1.id,
        student_id=ana.id,
        status=SubmissionStatus.submitted,
    )
    sub2 = Submission(
        assignment_id=a2.id,
        course_id=course2.id,
        student_id=bol.id,
        status=SubmissionStatus.needs_changes,
    )
    sub3 = Submission(
        assignment_id=a1.id,
        course_id=course1.id,
        student_id=ana.id,
        status=SubmissionStatus.reviewed,
    )
    db.add_all([sub1, sub2, sub3])
    db.commit()

    resp = client.get("/api/v1/teacher/queue", headers=auth_headers(teacher))
    assert resp.status_code == 200, resp.text
    page = resp.json()
    assert page["total"] == 2
    ids = {item["submission_id"] for item in page["items"]}
    assert ids == {sub1.id, sub2.id}
    by_id = {item["submission_id"]: item for item in page["items"]}
    assert by_id[sub1.id]["course_name"] == "Java"
    assert by_id[sub1.id]["student_name"] == "Ana"
    assert by_id[sub1.id]["status"] == "submitted"
    assert by_id[sub2.id]["status"] == "needs_changes"

    only_needs = client.get(
        "/api/v1/teacher/queue",
        params={"status": "needs_changes"},
        headers=auth_headers(teacher),
    ).json()
    assert only_needs["total"] == 1
    assert only_needs["items"][0]["submission_id"] == sub2.id

    only_course1 = client.get(
        "/api/v1/teacher/queue",
        params={"course_id": course1.id},
        headers=auth_headers(teacher),
    ).json()
    assert only_course1["total"] == 1
    assert only_course1["items"][0]["submission_id"] == sub1.id

    foreign = client.get(
        "/api/v1/teacher/queue",
        params={"course_id": course3.id},
        headers=auth_headers(teacher),
    )
    assert foreign.status_code == 404

    paged = client.get(
        "/api/v1/teacher/queue",
        params={"page": 2, "page_size": 1},
        headers=auth_headers(teacher),
    ).json()
    assert paged["total"] == 2
    assert len(paged["items"]) == 1
    assert paged["page"] == 2

    invalid = client.get(
        "/api/v1/teacher/queue",
        params={"status": "draft"},
        headers=auth_headers(teacher),
    )
    assert invalid.status_code == 422


def test_pending_count_and_forbidden(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="t2-count@aula.test")
    student = make_student(db, name="Ana", username="t2-cana")
    outsider = make_teacher(db, name="Otra", email="t2-cotra@aula.test")

    course = make_course(db, code="T2CC")
    assign_teacher(db, course, teacher)
    other = make_course(db, code="T2CO")
    assign_teacher(db, other, outsider)
    enroll(db, course, student)

    assignment = _seed_assignment(db, course, teacher, due_at=None)
    db.add(
        Submission(
            assignment_id=assignment.id,
            course_id=course.id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
        )
    )
    db.commit()

    count = client.get("/api/v1/teacher/pending-count", headers=auth_headers(teacher))
    assert count.status_code == 200, count.text
    assert count.json() == {"pending": 1}

    empty_teacher = make_teacher(db, email="t2-none@aula.test")
    none = client.get("/api/v1/teacher/pending-count", headers=auth_headers(empty_teacher))
    assert none.json() == {"pending": 0}

    for path in ("/api/v1/teacher/queue", "/api/v1/teacher/pending-count"):
        assert client.get(path, headers=auth_headers(student)).status_code == 403


def test_course_overview_and_student_detail(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="t3-profe@aula.test")
    ana = make_student(db, name="Ana", username="t3-ana")
    bol = make_student(db, name="Bol", username="t3-bol")

    course = make_course(db, code="T3C1")
    assign_teacher(db, course, teacher)
    enroll(db, course, ana)
    enroll(db, course, bol)

    a1 = _seed_assignment(db, course, teacher, title="Tarea A")
    _seed_assignment(db, course, teacher, title="Tarea B")

    sub = Submission(
        assignment_id=a1.id,
        course_id=course.id,
        student_id=ana.id,
        status=SubmissionStatus.reviewed,
        submitted_at=datetime.now(UTC),
    )
    db.add(sub)
    db.flush()
    db.add(Evaluation(submission_id=sub.id, teacher_id=teacher.id, score=Decimal("87.50")))
    db.add(
        AttendanceRecord(
            course_id=course.id,
            student_id=ana.id,
            date=date(2026, 9, 1),
            status=AttendanceStatus.present,
        )
    )
    db.add(
        AttendanceRecord(
            course_id=course.id,
            student_id=ana.id,
            date=date(2026, 9, 2),
            status=AttendanceStatus.absent,
        )
    )
    db.commit()

    resp = client.get(f"/api/v1/courses/{course.id}/overview", headers=auth_headers(teacher))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["course_name"] == "Java"
    assert [a["title"] for a in data["assignment_stats"]] == ["Tarea A", "Tarea B"]
    assert data["assignment_stats"][0]["submitted"] == 1
    assert data["assignment_stats"][0]["total"] == 2
    assert data["assignment_stats"][0]["pct"] == 50.0
    assert data["assignment_stats"][1]["submitted"] == 0
    assert data["assignment_stats"][1]["pct"] == 0.0

    by_name = {s["name"]: s for s in data["student_stats"]}
    assert by_name["Ana"]["submitted"] == 1
    assert by_name["Ana"]["pending"] == 1
    assert by_name["Ana"]["last_score"] == 87.5
    assert by_name["Ana"]["attendance_pct"] == 50.0
    assert by_name["Bol"]["submitted"] == 0
    assert by_name["Bol"]["pending"] == 2
    assert by_name["Bol"]["last_score"] is None
    assert by_name["Bol"]["attendance_pct"] is None

    detail = client.get(
        f"/api/v1/courses/{course.id}/students/{ana.id}",
        headers=auth_headers(teacher),
    )
    assert detail.status_code == 200, detail.text
    ficha = detail.json()
    assert ficha["student_id"] == ana.id
    assert ficha["name"] == "Ana"
    assert ficha["course_name"] == "Java"
    assert ficha["submitted"] == 1
    assert ficha["pending"] == 1
    assert ficha["average_score"] == 87.5
    assert ficha["attendance"]["present"] == 1
    assert ficha["attendance"]["absent"] == 1
    assert ficha["attendance"]["pct"] == 50.0
    assert len(ficha["submissions"]) == 1
    assert ficha["submissions"][0]["assignment_title"] == "Tarea A"
    assert ficha["submissions"][0]["status"] == "reviewed"
    assert ficha["submissions"][0]["score"] == 87.5
    assert ficha["submissions"][0]["evaluated_at"] is not None

    admin_headers = auth_headers(make_admin(db, email="t3-admin@aula.test"))
    assert (
        client.get(f"/api/v1/courses/{course.id}/overview", headers=admin_headers).status_code
        == 200
    )

    missing_student = client.get(
        f"/api/v1/courses/{course.id}/students/999999",
        headers=auth_headers(teacher),
    )
    assert missing_student.status_code == 404


def test_course_overview_forbidden_and_isolated(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="t3b-profe@aula.test")
    outsider = make_teacher(db, name="Otra", email="t3b-otra@aula.test")
    student = make_student(db, name="Ana", username="t3b-ana")

    course = make_course(db, code="T3BC1")
    assign_teacher(db, course, teacher)
    other = make_course(db, code="T3BC2")
    assign_teacher(db, other, outsider)
    enroll(db, course, student)
    _seed_assignment(db, course, teacher)

    overview = client.get(f"/api/v1/courses/{course.id}/overview", headers=auth_headers(student))
    assert overview.status_code == 403
    detail = client.get(
        f"/api/v1/courses/{course.id}/students/{student.id}",
        headers=auth_headers(student),
    )
    assert detail.status_code == 403

    foreign = client.get(f"/api/v1/courses/{other.id}/overview", headers=auth_headers(teacher))
    assert foreign.status_code == 404
    foreign_detail = client.get(
        f"/api/v1/courses/{other.id}/students/{student.id}",
        headers=auth_headers(teacher),
    )
    assert foreign_detail.status_code == 404

    empty = client.get(f"/api/v1/courses/{course.id}/overview", headers=auth_headers(outsider))
    assert empty.status_code == 404
