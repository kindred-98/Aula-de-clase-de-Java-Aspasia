"""Tests Fase B SaaS: registro público, Checkout, webhooks firmados y activación.

Cada webhook se firma con `WebhookSignature.generate_signature_header` (mismo
esquema HMAC-SHA256 que usa Stripe en producción) para probar la verificación
real, no un mock de la misma.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from stripe import WebhookSignature

from app.core.config import Settings, settings
from app.core.security import hash_secret
from app.models import (
    Assignment,
    AuditLog,
    Organization,
    OrgStatus,
    StripeWebhookEvent,
    Submission,
    User,
    UserRole,
)
from app.services.activation import generate_activation_token
from app.services.email import (
    ConsoleEmailService,
    OutboundEmail,
    ResendEmailService,
    get_email_service,
)
from scripts.cleanup_pending_organizations import cleanup_pending_organizations
from tests.api_helpers import (
    assign_teacher,
    auth_headers,
    enroll,
    make_admin,
    make_course,
    make_student,
    make_super_admin,
    make_teacher,
)

TEST_WEBHOOK_SECRET = "whsec_phase_b_secret"
CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_1"


@pytest.fixture(autouse=True)
def _billing_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "stripe_webhook_secret", TEST_WEBHOOK_SECRET)
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_dummy_key")
    monkeypatch.setattr(settings, "stripe_price_starter", "price_starter_test")


class _Outbox:
    """Bandeja falsa: el webhook recoge los emails y los envía tras el commit."""

    def __init__(self) -> None:
        self.sent: list[OutboundEmail] = []

    def send(self, email: OutboundEmail) -> None:
        self.sent.append(email)


@pytest.fixture()
def outbox(monkeypatch: pytest.MonkeyPatch) -> _Outbox:
    box = _Outbox()
    monkeypatch.setattr("app.api.v1.routes.webhooks.get_email_service", lambda: box)
    return box


def _event(event_type: str, obj: dict[str, Any], event_id: str) -> dict[str, Any]:
    return {"id": event_id, "object": "event", "type": event_type, "data": {"object": obj}}


def _post_event(
    client: TestClient,
    event: dict[str, Any],
    *,
    secret: str = TEST_WEBHOOK_SECRET,
    sign: bool = True,
) -> httpx.Response:
    payload = json.dumps(event)
    headers = {}
    if sign:
        headers["Stripe-Signature"] = WebhookSignature.generate_signature_header(payload, secret)
    return client.post("/api/v1/webhooks/stripe", content=payload.encode("utf-8"), headers=headers)


def _pending_org(db: Session, *, email: str, name: str = "Dicampus") -> Organization:
    org = Organization(
        name=name,
        tax_id="B12345678",
        billing_email=email,
        status=OrgStatus.pending_payment,
        plan_id="starter",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


# ---- Firma del webhook (la seguridad no negociable de la sección 6) ----


def test_webhook_without_signature_returns_400_and_changes_nothing(
    client: TestClient, db: Session
) -> None:
    org = _pending_org(db, email="nosig@x.io")
    users_before = int(db.scalar(select(func.count()).select_from(User)) or 0)

    resp = _post_event(
        client,
        _event(
            "checkout.session.completed",
            {"id": "cs_1", "metadata": {"organization_id": str(org.id)}},
            "evt_nosig",
        ),
        sign=False,
    )

    assert resp.status_code == 400
    assert org.status is OrgStatus.pending_payment
    assert int(db.scalar(select(func.count()).select_from(User)) or 0) == users_before
    assert int(db.scalar(select(func.count()).select_from(StripeWebhookEvent)) or 0) == 0


def test_webhook_rejects_signature_from_another_secret(client: TestClient, db: Session) -> None:
    org = _pending_org(db, email="othersecret@x.io")

    resp = _post_event(
        client,
        _event(
            "checkout.session.completed",
            {"id": "cs_2", "metadata": {"organization_id": str(org.id)}},
            "evt_othersig",
        ),
        secret="whsec_someone_elses_secret",
    )

    assert resp.status_code == 400
    assert org.status is OrgStatus.pending_payment
    assert db.scalar(select(func.count()).select_from(StripeWebhookEvent)) == 0


def test_webhook_rejects_garbage_payload_with_valid_signature(
    client: TestClient, db: Session
) -> None:
    from stripe import WebhookSignature as Sig

    payload = "esto no es json"
    header = Sig.generate_signature_header(payload, TEST_WEBHOOK_SECRET)
    resp = client.post(
        "/api/v1/webhooks/stripe",
        content=payload.encode("utf-8"),
        headers={"Stripe-Signature": header},
    )
    assert resp.status_code == 400
    assert db.scalar(select(func.count()).select_from(StripeWebhookEvent)) == 0


# ---- Flujo de alta: registro → Checkout → webhook → org_admin ----


def test_registration_and_checkout_completion_full_flow(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch, outbox: _Outbox
) -> None:
    monkeypatch.setattr(
        "app.api.v1.routes.public.create_checkout_session",
        lambda org, plan: CHECKOUT_URL,
    )

    # 1) Registro público: crea Organization pending_payment SIN User
    resp = client.post(
        "/api/v1/public/organizations",
        json={
            "name": "Dicampus",
            "tax_id": "B12345678",
            "billing_email": "dicampus@x.io",
            "plan_id": "starter",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["checkout_url"] == CHECKOUT_URL
    org = db.get(Organization, body["organization_id"])
    assert org is not None
    assert org.status is OrgStatus.pending_payment
    assert org.plan_id == "starter"
    assert (
        db.scalar(select(func.count()).select_from(User).where(User.email == "dicampus@x.io")) == 0
    )

    # 2) checkout.session.completed firmado → trialing + org_admin sin contraseña
    event = _event(
        "checkout.session.completed",
        {
            "id": "cs_test_1",
            "customer": "cus_123",
            "subscription": "sub_123",
            "metadata": {"organization_id": str(org.id)},
        },
        "evt_checkout_ok",
    )
    resp = _post_event(client, event)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"received": "ok"}

    assert org.status is OrgStatus.trialing
    assert org.stripe_customer_id == "cus_123"
    assert org.stripe_subscription_id == "sub_123"
    trial = _aware(org.trial_ends_at)
    assert trial is not None
    delta = trial - datetime.now(UTC)
    assert timedelta(days=13, hours=23) < delta < timedelta(days=14, hours=1)

    admin = db.scalar(select(User).where(User.email == "dicampus@x.io"))
    assert admin is not None
    assert admin.role is UserRole.org_admin
    assert admin.organization_id == org.id
    assert admin.password_hash is None
    assert admin.activation_token_hash is not None

    # 3) Email de activación: enlace de un solo uso; en BD solo vive el hash
    assert len(outbox.sent) == 1
    mail = outbox.sent[0]
    assert mail.to == "dicampus@x.io"
    match = re.search(r"/activar-cuenta/([A-Za-z0-9_\-]+)", mail.html)
    assert match is not None
    token = match.group(1)
    assert hashlib.sha256(token.encode()).hexdigest() == admin.activation_token_hash
    assert token not in (admin.activation_token_hash or "")

    # 4) Idempotencia: mismo event_id otra vez → sin efectos
    resp = _post_event(client, event)
    assert resp.status_code == 200
    assert resp.json() == {"received": "duplicate"}
    assert (
        db.scalar(select(func.count()).select_from(User).where(User.email == "dicampus@x.io")) == 1
    )
    assert len(outbox.sent) == 1
    assert db.scalar(select(func.count()).select_from(StripeWebhookEvent)) == 1


# ---- Login bloqueado hasta activar ----


def test_org_admin_cannot_login_until_account_is_activated(client: TestClient, db: Session) -> None:
    org = _pending_org(db, email="noact@x.io")
    db.add(
        User(
            name="Dicampus",
            email="noact@x.io",
            role=UserRole.org_admin,
            organization_id=org.id,
            password_hash=None,  # creado por el webhook, sin activar
            is_active=True,
            must_change_credentials=False,
        )
    )
    db.commit()

    resp = client.post(
        "/api/v1/auth/login/staff",
        json={"email": "noact@x.io", "password": "secreta123"},
    )
    assert resp.status_code == 401
    assert "not activated" in resp.json()["detail"].lower()
    assert "access_token" not in resp.json()

    # traza explícita en AuditLog (sin secretos)
    log = db.scalar(
        select(AuditLog).where(AuditLog.action == "auth.login_failed").order_by(AuditLog.id.desc())
    )
    assert log is not None
    assert log.payload.get("reason") == "not_activated"

    # contraste: con contraseña ya creada, el mismo login funciona
    other_org = _pending_org(db, email="activa@x.io")
    db.add(
        User(
            name="Ya Activada",
            email="activa@x.io",
            role=UserRole.org_admin,
            organization_id=other_org.id,
            password_hash=hash_secret("secreta123"),
            is_active=True,
            must_change_credentials=False,
        )
    )
    db.commit()
    ok = client.post(
        "/api/v1/auth/login/staff", json={"email": "activa@x.io", "password": "secreta123"}
    )
    assert ok.status_code == 200
    assert "access_token" in ok.json()


# ---- Activación: 48 h, un solo uso ----


def test_activation_flow_success_reuse_and_expiry(client: TestClient, db: Session) -> None:
    org = _pending_org(db, email="act@x.io")
    user = User(
        name="Dicampus",
        email="act@x.io",
        role=UserRole.org_admin,
        organization_id=org.id,
        password_hash=None,
        is_active=True,
        must_change_credentials=False,
    )
    db.add(user)
    db.flush()
    token = generate_activation_token(user)
    db.commit()

    # GET de información (pantalla de activación)
    info = client.get("/api/v1/auth/activate", params={"token": token})
    assert info.status_code == 200
    assert info.json()["email"] == "act@x.io"

    # Activar: crea la contraseña y consume el token
    resp = client.post("/api/v1/auth/activate", json={"token": token, "password": "nuevaclave1"})
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "activated", "email": "act@x.io"}
    db.refresh(user)
    assert user.password_hash is not None
    assert user.activation_token_hash is None
    assert user.activation_token_expires_at is None

    # Reuso del mismo token → 4xx
    reuse = client.post("/api/v1/auth/activate", json={"token": token, "password": "otraclave1"})
    assert 400 <= reuse.status_code < 500

    # Tras activar, el login staff funciona
    login = client.post(
        "/api/v1/auth/login/staff", json={"email": "act@x.io", "password": "nuevaclave1"}
    )
    assert login.status_code == 200

    # Token inválido → 400
    bogus = client.get("/api/v1/auth/activate", params={"token": "x" * 43})
    assert bogus.status_code == 400

    # Token expirado (>48 h) → 4xx
    other = User(
        name="Dicampus 2",
        email="act2@x.io",
        role=UserRole.org_admin,
        organization_id=org.id,
        password_hash=None,
        is_active=True,
        must_change_credentials=False,
    )
    db.add(other)
    db.flush()
    expired_token = generate_activation_token(other)
    other.activation_token_expires_at = datetime.now(UTC) - timedelta(hours=1)
    db.commit()
    expired = client.post(
        "/api/v1/auth/activate", json={"token": expired_token, "password": "nuevaclave1"}
    )
    assert 400 <= expired.status_code < 500


# ---- Ciclo de vida de la suscripción ----


def test_subscription_lifecycle_events_update_org_status(
    client: TestClient, db: Session, outbox: _Outbox
) -> None:
    org = _pending_org(db, email="ciclo@x.io")
    org.status = OrgStatus.trialing
    org.stripe_subscription_id = "sub_life"
    org.stripe_customer_id = "cus_life"
    db.commit()

    # invoice.payment_succeeded (formato nuevo: parent.subscription_details)
    ok = _post_event(
        client,
        _event(
            "invoice.payment_succeeded",
            {
                "id": "in_1",
                "customer": "cus_life",
                "parent": {"subscription_details": {"subscription": "sub_life"}},
            },
            "evt_inv_ok",
        ),
    )
    assert ok.status_code == 200
    assert org.status is OrgStatus.active

    # invoice.payment_failed
    failed = _post_event(
        client,
        _event(
            "invoice.payment_failed",
            {"id": "in_2", "customer": "cus_life", "subscription": "sub_life"},
            "evt_inv_failed",
        ),
    )
    assert failed.status_code == 200
    assert org.status is OrgStatus.past_due

    # customer.subscription.deleted
    deleted = _post_event(
        client,
        _event(
            "customer.subscription.deleted",
            {"id": "sub_life", "customer": "cus_life"},
            "evt_sub_deleted",
        ),
    )
    assert deleted.status_code == 200
    assert org.status is OrgStatus.canceled

    # customer.subscription.trial_will_end → email de aviso, sin cambiar estado
    trial = _post_event(
        client,
        _event(
            "customer.subscription.trial_will_end",
            {
                "id": "sub_life",
                "customer": "cus_life",
                "trial_end": int((datetime.now(UTC) + timedelta(days=3)).timestamp()),
            },
            "evt_trial_will_end",
        ),
    )
    assert trial.status_code == 200
    assert org.status is OrgStatus.canceled
    assert len(outbox.sent) == 1
    assert outbox.sent[0].to == "ciclo@x.io"
    assert "prueba" in outbox.sent[0].subject.lower()

    # evento de un desconocido → 200 y sin efectos (no rompe el webhook)
    unknown = _post_event(client, _event("charge.refunded", {"id": "ch_1"}, "evt_unknown"))
    assert unknown.status_code == 200
    assert unknown.json() == {"received": "ok"}


# ---- super_admin fuera del contenido académico (sección 6) ----


def test_super_admin_blocked_from_academic_content_routes(client: TestClient, db: Session) -> None:
    root = make_super_admin(db)
    make_admin(db)
    course = make_course(db, code="BPH1")
    teacher = make_teacher(db, email="bph@aula.test")
    assign_teacher(db, course, teacher)
    student = make_student(db, username="bph1")
    enroll(db, course, student)

    assignment = Assignment(
        course_id=course.id,
        title="T",
        description_markdown="",
        created_by=teacher.id,
    )
    db.add(assignment)
    db.flush()
    submission = Submission(
        assignment_id=assignment.id,
        course_id=course.id,
        student_id=student.id,
        notes="ok",
    )
    db.add(submission)
    db.commit()

    headers = auth_headers(root)

    # URLs construidas a mano, nunca enlazadas desde la UI
    checks: list[tuple[str, str, dict[str, Any], set[int]]] = [
        ("GET", f"/api/v1/submissions/{submission.id}", {}, {404}),
        ("POST", f"/api/v1/submissions/{submission.id}/evaluations", {}, {403, 404}),
        ("GET", f"/api/v1/courses/{course.id}/chat", {}, {403, 404}),
        ("POST", f"/api/v1/courses/{course.id}/chat", {"body": "hola"}, {403, 404}),
    ]
    for method, path, json_body, allowed in checks:
        if method == "GET":
            resp = client.get(path, headers=headers)
        else:
            resp = client.post(path, json=json_body, headers=headers)
        assert resp.status_code in allowed, f"{method} {path} → {resp.status_code}"
        assert resp.status_code not in (200, 201), f"{method} {path} no debe permitirse"


# ---- Configuración en producción ----


def test_settings_production_requires_billing_secrets() -> None:
    base: dict[str, Any] = {"_env_file": None, "environment": "production", "secret_key": "p" * 40}

    with pytest.raises(ValidationError, match="STRIPE_SECRET_KEY"):
        Settings(**base)

    with pytest.raises(ValidationError, match="placeholder"):
        Settings(
            **{
                **base,
                "stripe_secret_key": "sk_test_devplaceholder",
                "stripe_webhook_secret": "whsec_live_key",
                "resend_api_key": "re_live_key",
            }
        )

    ok = Settings(
        **{
            **base,
            "stripe_secret_key": "sk_live_abc123",
            "stripe_webhook_secret": "whsec_live_abc123",
            "resend_api_key": "re_abc123",
        }
    )
    assert ok.environment == "production"

    dev = Settings(_env_file=None)
    assert dev.environment == "development"
    assert dev.stripe_secret_key == ""


# ---- Limpieza de pending_payment a 7 días ----


def test_cleanup_removes_only_stale_pending_orgs_without_users(db: Session) -> None:
    stale = _pending_org(db, email="stale@x.io")
    stale.created_at = datetime.now(UTC) - timedelta(days=8)
    recent = _pending_org(db, email="recent@x.io")
    trial_old = _pending_org(db, email="trial-old@x.io")
    trial_old.status = OrgStatus.trialing
    trial_old.created_at = datetime.now(UTC) - timedelta(days=30)
    with_user = _pending_org(db, email="withuser@x.io")
    with_user.created_at = datetime.now(UTC) - timedelta(days=30)
    db.add(
        User(
            name="Admin Viejo",
            email="withuser@x.io",
            role=UserRole.org_admin,
            organization_id=with_user.id,
            password_hash="x",
            is_active=True,
            must_change_credentials=False,
        )
    )
    db.commit()

    removed = cleanup_pending_organizations(db)

    assert removed == 1
    assert db.scalar(select(Organization.id).where(Organization.id == stale.id)) is None
    assert db.scalar(select(Organization.id).where(Organization.id == recent.id)) is not None
    assert db.scalar(select(Organization.id).where(Organization.id == trial_old.id)) is not None
    assert db.scalar(select(Organization.id).where(Organization.id == with_user.id)) is not None


# ---- Rutas públicas ----


def test_public_plans_endpoint(client: TestClient) -> None:
    resp = client.get("/api/v1/public/plans")
    assert resp.status_code == 200
    plans = resp.json()
    assert {p["id"] for p in plans} == {"starter", "growth", "campus"}
    starter = next(p for p in plans if p["id"] == "starter")
    assert starter["price_eur"] == 29
    assert starter["currency"] == "EUR"
    assert starter["max_courses"] == 3


def test_register_organization_conflicts(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.api.v1.routes.public.create_checkout_session",
        lambda org, plan: CHECKOUT_URL,
    )

    # plan inexistente
    unknown = client.post(
        "/api/v1/public/organizations",
        json={"name": "X", "tax_id": "T1", "billing_email": "x@x.io", "plan_id": "nope"},
    )
    assert unknown.status_code == 404

    # billing email de una organización ya activa → 409
    active = Organization(
        name="Ya Cliente",
        tax_id="C1",
        billing_email="dup@x.io",
        status=OrgStatus.active,
        plan_id="starter",
    )
    db.add(active)
    db.commit()
    dup = client.post(
        "/api/v1/public/organizations",
        json={"name": "X", "tax_id": "T1", "billing_email": "dup@x.io", "plan_id": "starter"},
    )
    assert dup.status_code == 409

    # plan sin Price configurado → 503 (billing no preparado)
    monkeypatch.setattr(settings, "stripe_price_starter", "")
    not_configured = client.post(
        "/api/v1/public/organizations",
        json={"name": "X", "tax_id": "T1", "billing_email": "y@x.io", "plan_id": "starter"},
    )
    assert not_configured.status_code == 503
    assert (
        db.scalar(
            select(func.count())
            .select_from(Organization)
            .where(Organization.billing_email == "y@x.io")
        )
        == 0
    )


# ---- Stripe Checkout (parámetros de la sección 4) ----


def test_create_checkout_session_sends_subscription_params(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.plans import get_plan
    from app.services.stripe_billing import StripeBillingError, create_checkout_session

    captured: dict[str, Any] = {}

    class _FakeSession:
        url: str | None = "https://checkout.stripe.com/c/pay/cs_live_1"

    def _create(**kwargs: Any) -> _FakeSession:
        captured.update(kwargs)
        return _FakeSession()

    monkeypatch.setattr("stripe.checkout.Session.create", _create)
    org = _pending_org(db, email="checkout@x.io")
    plan = get_plan("starter")
    assert plan is not None

    url = create_checkout_session(org, plan)
    assert url == "https://checkout.stripe.com/c/pay/cs_live_1"
    assert captured["mode"] == "subscription"
    assert captured["customer_email"] == "checkout@x.io"
    assert captured["payment_method_collection"] == "always"
    assert captured["line_items"] == [{"price": "price_starter_test", "quantity": 1}]
    assert captured["metadata"] == {"organization_id": str(org.id)}
    assert captured["subscription_data"]["metadata"] == {"organization_id": str(org.id)}
    assert captured["subscription_data"]["trial_period_days"] == 14

    # sin clave de Stripe → error controlado (la ruta responde 502)
    monkeypatch.setattr(settings, "stripe_secret_key", "")
    with pytest.raises(StripeBillingError):
        create_checkout_session(org, plan)

    # sin Price configurado para el plan → error controlado
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_key")
    monkeypatch.setattr(settings, "stripe_price_starter", "")
    with pytest.raises(StripeBillingError):
        create_checkout_session(org, plan)


# ---- EmailService ----


def test_email_service_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "resend_api_key", "")
    assert isinstance(get_email_service(), ConsoleEmailService)
    monkeypatch.setattr(settings, "resend_api_key", "re_key_1")
    assert isinstance(get_email_service(), ResendEmailService)


def test_resend_service_posts_expected_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    class _Resp:
        def raise_for_status(self) -> None:
            captured["ok"] = True

    def _post(url: str, **kwargs: Any) -> _Resp:
        captured["url"] = url
        captured.update(kwargs)
        return _Resp()

    monkeypatch.setattr("app.services.email.httpx.post", _post)
    ResendEmailService("re_test_key", "Aspasia <no-reply@x.io>").send(
        OutboundEmail(to="a@b.io", subject="Hola", html="<p>hola</p>")
    )
    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer re_test_key"
    assert captured["json"]["from"] == "Aspasia <no-reply@x.io>"
    assert captured["json"]["to"] == ["a@b.io"]
    assert captured["ok"] is True


def test_console_email_service_logs(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.services.email"):
        ConsoleEmailService().send(
            OutboundEmail(to="a@b.io", subject="Activa tu cuenta", html="<p>link</p>")
        )
    assert "a@b.io" in caplog.text
    assert "Activa tu cuenta" in caplog.text
