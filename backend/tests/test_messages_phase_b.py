"""Tests Fase B: directorio messageable, unread-count y chat global por curso."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def test_classmate_can_private_message(client: TestClient, db: Session) -> None:
    course = make_course(db, code="PEER1")
    a = make_student(db, name="Ana", username="ana1")
    b = make_student(db, name="Luis", username="luis1")
    enroll(db, course, a)
    enroll(db, course, b)

    resp = client.post(
        "/api/v1/messages",
        json={"recipient_id": b.id, "body": "¿copias el ejercicio?"},
        headers=auth_headers(a),
    )
    assert resp.status_code == 201, resp.text

    outsider = make_student(db, name="Otro", username="otro9")
    denied = client.post(
        "/api/v1/messages",
        json={"recipient_id": outsider.id, "body": "hola"},
        headers=auth_headers(a),
    )
    assert denied.status_code == 403


def test_directory_role_matrix(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="dir-admin@aula.test")
    teacher = make_teacher(db, email="dir-profe@aula.test")
    other_teacher = make_teacher(db, name="Otra", email="dir-otra@aula.test")
    course = make_course(db, code="DIR1")
    assign_teacher(db, course, teacher)
    student = make_student(db, name="Ana", username="dir-ana")
    classmate = make_student(db, name="Luis", username="dir-luis")
    outsider = make_student(db, name="Zoe", username="dir-zoe")
    enroll(db, course, student)
    enroll(db, course, classmate)

    admin_dir = {
        e["id"]
        for e in client.get("/api/v1/messages/directory", headers=auth_headers(admin)).json()
    }
    assert student.id in admin_dir
    assert teacher.id in admin_dir
    assert admin.id not in admin_dir

    teacher_dir = {
        e["id"]
        for e in client.get("/api/v1/messages/directory", headers=auth_headers(teacher)).json()
    }
    assert admin.id in teacher_dir
    assert student.id in teacher_dir
    assert classmate.id in teacher_dir
    assert other_teacher.id not in teacher_dir
    assert teacher.id not in teacher_dir

    student_dir = client.get("/api/v1/messages/directory", headers=auth_headers(student)).json()
    student_ids = {e["id"] for e in student_dir}
    assert admin.id in student_ids
    assert teacher.id in student_ids
    assert classmate.id in student_ids
    assert outsider.id not in student_ids
    assert student.id not in student_ids
    classmate_entry = next(e for e in student_dir if e["id"] == classmate.id)
    assert course.id in classmate_entry["course_ids"]
    teacher_entry = next(e for e in student_dir if e["id"] == teacher.id)
    assert course.id in teacher_entry["course_ids"]


def test_unread_count_private_and_course(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="unread-admin@aula.test")
    teacher = make_teacher(db, email="unread-profe@aula.test")
    course = make_course(db, code="UNR1")
    assign_teacher(db, course, teacher)
    student = make_student(db, username="unread-ana")
    classmate = make_student(db, name="Luis", username="unread-luis")
    enroll(db, course, student)
    enroll(db, course, classmate)

    client.post(
        "/api/v1/messages",
        json={"recipient_id": student.id, "body": "Hola Ana"},
        headers=auth_headers(admin),
    )
    client.post(
        f"/api/v1/courses/{course.id}/chat",
        json={"body": "Buenos días clase"},
        headers=auth_headers(teacher),
    )

    resp = client.get("/api/v1/messages/unread-count", headers=auth_headers(student))
    assert resp.status_code == 200
    body = resp.json()
    assert body["private"] == 1
    assert body["courses"][str(course.id)] == 1

    client.post(f"/api/v1/courses/{course.id}/chat/read", headers=auth_headers(student))
    client.post(f"/api/v1/messages/{admin.id}/read", headers=auth_headers(student))
    after = client.get("/api/v1/messages/unread-count", headers=auth_headers(student))
    assert after.json()["private"] == 0
    assert after.json()["courses"] == {}


def test_course_chat_flow_and_outsider_404(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="chat-profe@aula.test")
    course = make_course(db, code="CGLOB")
    assign_teacher(db, course, teacher)
    student = make_student(db, username="chat-ana")
    outsider = make_student(db, name="Zoe", username="chat-zoe")
    enroll(db, course, student)

    post = client.post(
        f"/api/v1/courses/{course.id}/chat",
        json={"body": "Subid el ejercicio 1"},
        headers=auth_headers(teacher),
    )
    assert post.status_code == 201, post.text
    assert post.json()["sender_role"] == "teacher"

    reply = client.post(
        f"/api/v1/courses/{course.id}/chat",
        json={"body": "¡Hecho!"},
        headers=auth_headers(student),
    )
    assert reply.status_code == 201

    page = client.get(f"/api/v1/courses/{course.id}/chat", headers=auth_headers(student))
    assert page.status_code == 200
    data = page.json()
    assert data["total"] == 2
    assert [m["body"] for m in data["items"]] == ["Subid el ejercicio 1", "¡Hecho!"]

    outsider_get = client.get(f"/api/v1/courses/{course.id}/chat", headers=auth_headers(outsider))
    assert outsider_get.status_code == 404
    outsider_post = client.post(
        f"/api/v1/courses/{course.id}/chat",
        json={"body": "spam"},
        headers=auth_headers(outsider),
    )
    assert outsider_post.status_code == 404

    rooms_student = client.get("/api/v1/me/course-chats", headers=auth_headers(student))
    assert rooms_student.status_code == 200
    assert any(r["course_id"] == course.id for r in rooms_student.json())
    rooms_teacher = client.get("/api/v1/me/course-chats", headers=auth_headers(teacher))
    assert any(r["course_id"] == course.id and r["unread"] >= 1 for r in rooms_teacher.json())


def test_student_cannot_message_non_classmate_student(client: TestClient, db: Session) -> None:
    course_a = make_course(db, code="ISO-A")
    course_b = make_course(db, code="ISO-B")
    a = make_student(db, name="Ana", username="iso-ana")
    b = make_student(db, name="Luis", username="iso-luis")
    enroll(db, course_a, a)
    enroll(db, course_b, b)
    resp = client.post(
        "/api/v1/messages",
        json={"recipient_id": b.id, "body": "hola"},
        headers=auth_headers(a),
    )
    assert resp.status_code == 403
