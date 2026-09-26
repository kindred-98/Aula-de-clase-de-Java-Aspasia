"""Tests de sistema y configuración."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app import __version__
from app.core.config import Settings, get_settings
from app.main import app


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["app"]
    assert datetime.fromisoformat(body["time"]).tzinfo is not None


def test_health_under_api_prefix() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200


def test_settings_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.api_prefix == "/api/v1"
    assert settings.max_upload_mb == 10
    assert settings.max_upload_bytes == 10 * 1024 * 1024
    assert "http://localhost:5173" in settings.cors_origin_list


def test_get_settings_cached() -> None:
    assert get_settings() is get_settings()


def test_security_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_no_csp_in_development() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert "Content-Security-Policy" not in response.headers


def test_csp_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main as main_module

    monkeypatch.setattr(
        main_module,
        "settings",
        Settings(
            _env_file=None,
            environment="production",
            secret_key="p" * 40,
            stripe_secret_key="sk_live_key_001",
            stripe_webhook_secret="whsec_live_key_001",
            resend_api_key="re_key_001",
        ),
    )
    prod_app = main_module.create_app()
    with TestClient(prod_app) as client:
        response = client.get("/health", headers={"Host": "localhost"})
    assert response.status_code == 200
    csp = response.headers["Content-Security-Policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


def test_utcnow_aware() -> None:
    from app.db.base import utcnow

    now = utcnow()
    assert now.tzinfo is not None
    assert now <= datetime.now(UTC)
