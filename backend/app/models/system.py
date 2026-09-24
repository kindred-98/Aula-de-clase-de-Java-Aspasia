"""Ajustes globales del centro (clave-valor JSON)."""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

try:  # JSONB en PostgreSQL, JSON en SQLite (tests locales)
    from sqlalchemy.dialects.postgresql import JSONB

    JsonType = JSON().with_variant(JSONB(), "postgresql")
except ImportError:  # pragma: no cover
    JsonType = JSON()


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict[str, Any]] = mapped_column(
        JsonType, nullable=False, default=dict, server_default="{}"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
