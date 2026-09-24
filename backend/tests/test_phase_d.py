"""Tests Fase D: categorías, cohorts, autoenrolamiento, roles, sesiones, unlock."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AuditLog, RefreshToken
from app.services import auth_service
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_teacher,
)


def test_category_crud_and_taxonomy(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="cat-admin@aula.test")
    teacher = make_teacher(db, email="cat-profe@aula.test")
    course = make_course(db, code="CAT1")

    denied = client.post(
        "/api/v1/admin/categories",
        json={"name": "Programación", "slug": "programacion"},
        headers=auth_headers(teacher),
    )
    assert denied.status_code == 403

    created = client.post(
        "/api/v1/admin/categories",
        json={"name": "Programación", "slug": "programacion"},
        headers=auth_headers(admin),
    )
    assert created.status_code == 201, created.text
    category_id = created.json()["id"]

    dup = client.post(
        "/api/v1/admin/categories",
        json={"name": "Otra", "slug": "programacion"},
        headers=auth_headers(admin),
    )
    assert dup.status_code == 409

    taxonomy = client.patch(
        f"/api/v1/admin/courses/{course.id}/taxonomy",
        json={"category_id": category_id, "cohort_id": None},
        headers=auth_headers(admin),
    )
    assert taxonomy.status_code == 200, taxonomy.text
    assert taxonomy.json() == {
        "course_id": course.id,
        "category_id": category_id,
        "cohort_id": None,
    }

    listed = client.get("/api/v1/categories", headers=auth_headers(teacher)).json()
    assert listed[0]["slug"] == "programacion"
    assert listed[0]["course_count"] == 1

    bad = client.patch(
        f"/api/v1/admin/courses/{course.id}/taxonomy",
        json={"category_id": 999999},
        headers=auth_headers(admin),
    )
    assert bad.status_code == 404

    updated = client.patch(
        f"/api/v1/admin/categories/{category_id}",
        json={"name": "Prog"},
        headers=auth_headers(admin),
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Prog"

    deleted = client.delete(f"/api/v1/admin/categories/{category_id}", headers=auth_headers(admin))
    assert deleted.status_code == 204
    assert client.get("/api/v1/categories", headers=auth_headers(admin)).json() == []


def test_cohort_members_and_auto_enroll(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="co-admin@aula.test")
    teacher = make_teacher(db, email="co-profe@aula.test")
    course = make_course(db, code="COH1")  # 3x5 = 15 asientos
    assign_teacher(db, course, teacher)

    cohort = client.post(
        "/api/v1/admin/cohorts",
        json={"name": "Grupo A", "code": "GA1"},
        headers=auth_headers(admin),
    )
    assert cohort.status_code == 201, cohort.text
    cohort_id = cohort.json()["id"]

    a = make_student(db, name="Ana", username="coh-ana")
    luis = make_student(db, name="Luis", username="coh-luis")
    enroll(db, course, a)  # ya matriculado

    added = client.post(
        f"/api/v1/admin/cohorts/{cohort_id}/members",
        json={"student_ids": [a.id, luis.id]},
        headers=auth_headers(admin),
    )
    assert added.status_code == 200, added.text
    assert {m["student_id"] for m in added.json()} == {a.id, luis.id}

    # Idempotente: repetir no duplica
    again = client.post(
        f"/api/v1/admin/cohorts/{cohort_id}/members",
        json={"student_id": a.id},
        headers=auth_headers(admin),
    )
    assert again.json() == []

    detail = client.get(f"/api/v1/admin/cohorts/{cohort_id}", headers=auth_headers(admin)).json()
    assert detail["member_count"] == 2
    assert {m["student_id"] for m in detail["members"]} == {a.id, luis.id}

    # Sin cohort asignada → 400 (reason no_cohort en el cuerpo)
    no_cohort = client.post(f"/api/v1/courses/{course.id}/auto-enroll", headers=auth_headers(admin))
    assert no_cohort.status_code == 200
    assert no_cohort.json()["reason"] == "no_cohort"

    client.patch(
        f"/api/v1/admin/courses/{course.id}/taxonomy",
        json={"category_id": None, "cohort_id": cohort_id},
        headers=auth_headers(admin),
    )

    result = client.post(f"/api/v1/courses/{course.id}/auto-enroll", headers=auth_headers(teacher))
    assert result.status_code == 200, result.text
    body = result.json()
    # Ana ya estaba matriculada (skipped), Luis se matricula ahora
    assert body["enrolled"] == 1
    assert body["skipped"] == 1

    enrollments = client.get(
        f"/api/v1/courses/{course.id}/enrollments", headers=auth_headers(admin)
    ).json()
    assert {e["student_id"] for e in enrollments} == {a.id, luis.id}

    removed = client.delete(
        f"/api/v1/admin/cohorts/{cohort_id}/members/{luis.id}",
        headers=auth_headers(admin),
    )
    assert removed.status_code == 204
    detail = client.get(f"/api/v1/admin/cohorts/{cohort_id}", headers=auth_headers(admin)).json()
    assert detail["member_count"] == 1


def test_auto_enroll_requires_staff(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="ae-admin@aula.test")
    course = make_course(db, code="AE01")
    outsider = make_student(db, name="Zoe", username="ae-zoe")

    resp = client.post(f"/api/v1/courses/{course.id}/auto-enroll", headers=auth_headers(outsider))
    assert resp.status_code == 403

    resp = client.post(f"/api/v1/courses/{course.id}/auto-enroll", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.json()["reason"] == "no_cohort"


def test_custom_role_permissions_gate_reports(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="rl-admin@aula.test")
    teacher = make_teacher(db, email="rl-profe@aula.test")

    # Catálogo de permisos
    catalog = client.get("/api/v1/admin/permissions", headers=auth_headers(admin)).json()
    assert "reports.view" in catalog["permissions"]

    # Crear rol con permiso de reportes
    role = client.post(
        "/api/v1/admin/roles",
        json={"name": "Coordinator", "permissions": ["reports.view"]},
        headers=auth_headers(admin),
    )
    assert role.status_code == 201, role.text
    role_id = role.json()["id"]

    invalid = client.post(
        "/api/v1/admin/roles",
        json={"name": "Malo", "permissions": ["not.a.perm"]},
        headers=auth_headers(admin),
    )
    assert invalid.status_code == 422

    # Teacher sin rol: sin acceso a reportes ni settings
    assert (
        client.get("/api/v1/admin/reports/overview", headers=auth_headers(teacher)).status_code
        == 403
    )
    assert client.get("/api/v1/admin/settings", headers=auth_headers(teacher)).status_code == 403

    # Asignar rol
    assigned = client.post(
        f"/api/v1/admin/users/{teacher.id}/custom-role",
        json={"custom_role_id": role_id},
        headers=auth_headers(admin),
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["name"] == "Coordinator"
    assert assigned.json()["assigned_count"] == 1

    perms = client.get("/api/v1/auth/permissions", headers=auth_headers(teacher)).json()
    assert perms["effective"] == ["reports.view"]

    # Ahora ve reportes pero sigue sin settings
    reports = client.get("/api/v1/admin/reports/overview", headers=auth_headers(teacher))
    assert reports.status_code == 200, reports.text
    assert client.get("/api/v1/admin/settings", headers=auth_headers(teacher)).status_code == 403

    # Quitar rol
    cleared = client.post(
        f"/api/v1/admin/users/{teacher.id}/custom-role",
        json={"custom_role_id": None},
        headers=auth_headers(admin),
    )
    assert cleared.status_code == 200
    assert cleared.json() is None
    assert (
        client.get("/api/v1/admin/reports/overview", headers=auth_headers(teacher)).status_code
        == 403
    )

    # Borrar rol
    assert (
        client.delete(f"/api/v1/admin/roles/{role_id}", headers=auth_headers(admin)).status_code
        == 204
    )
    assert client.get("/api/v1/admin/roles", headers=auth_headers(admin)).json() == []


def test_admin_roles_crud_requires_admin(client: TestClient, db: Session) -> None:
    teacher = make_teacher(db, email="s-admin-profe@aula.test")
    assert client.get("/api/v1/admin/roles", headers=auth_headers(teacher)).status_code == 403
    assert client.get("/api/v1/admin/sessions", headers=auth_headers(teacher)).status_code == 403


def test_active_sessions_list_and_revoke(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="ses-admin@aula.test")
    teacher = make_teacher(db, email="ses-profe@aula.test")

    # Simular sesión activa (refresh token no revocado)
    db.add(
        RefreshToken(
            user_id=teacher.id,
            token_hash="a" * 64,
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
    )
    db.commit()

    sessions = client.get("/api/v1/admin/sessions", headers=auth_headers(admin))
    assert sessions.status_code == 200, sessions.text
    rows = sessions.json()
    assert any(r["user_id"] == teacher.id for r in rows)

    revoked = client.post(
        "/api/v1/admin/sessions/revoke",
        json={"user_id": teacher.id},
        headers=auth_headers(admin),
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["revoked"] == 1

    sessions_after = client.get("/api/v1/admin/sessions", headers=auth_headers(admin)).json()
    assert all(r["user_id"] != teacher.id for r in sessions_after)

    missing = client.post(
        "/api/v1/admin/sessions/revoke",
        json={"user_id": 999999},
        headers=auth_headers(admin),
    )
    assert missing.status_code == 404


def test_unlock_clears_failed_logins(client: TestClient, db: Session) -> None:
    admin = make_admin(db, email="un-admin@aula.test")
    teacher = make_teacher(db, email="un-profe@aula.test")

    for _ in range(3):
        auth_service.record_failed_login(
            db, identifier=teacher.email or "", ip="10.0.0.9", reason="bad_credentials"
        )
    db.commit()
    assert auth_service.count_recent_failures(db, identifier=teacher.email) == 3

    resp = client.post(f"/api/v1/admin/users/{teacher.id}/unlock", headers=auth_headers(admin))
    assert resp.status_code == 200, resp.text
    assert resp.json()["cleared_failures"] == 3
    assert auth_service.count_recent_failures(db, identifier=teacher.email) == 0

    missing = client.post("/api/v1/admin/users/999999/unlock", headers=auth_headers(admin))
    assert missing.status_code == 404

    # Auditoría del desbloqueo
    actions = [
        a.action for a in db.query(AuditLog).filter(AuditLog.action == "user.unlocked").all()
    ]
    assert actions == ["user.unlocked"]
