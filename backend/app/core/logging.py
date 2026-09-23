"""Logging estructurado en JSON sin datos sensibles."""

import logging
import sys
from typing import Any

_SENSITIVE_KEYS = frozenset(
    {
        "pin",
        "password",
        "password_hash",
        "pin_hash",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "secret_key",
        "authorization",
    }
)


class JsonFormatter(logging.Formatter):
    """Formato una línea JSON por log; enmascara claves sensibles."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        from datetime import UTC, datetime

        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            for key, value in extra.items():
                payload[key] = "***" if key.lower() in _SENSITIVE_KEYS else value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


def log_event(logger: logging.Logger, event: str, **fields: Any) -> None:
    """Emitir un evento estructurado; las claves sensibles se enmascaran."""
    safe = {k: ("***" if k.lower() in _SENSITIVE_KEYS else v) for k, v in fields.items()}
    logger.info(event, extra={"extra_fields": safe})
