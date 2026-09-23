"""Esquemas de panel admin: usuarios, PIN, CSV, audit log."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class AdminUserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    username: str | None
    role: UserRole
    is_active: bool
    must_change_credentials: bool
    created_at: datetime


class PinResetRequest(BaseModel):
    """Reset de PIN de estudiante. El PIN nuevo se devuelve una sola vez."""

    pin: str | None = Field(default=None, pattern=r"^\d{6,}$")


class PinResetResponse(BaseModel):
    user_id: int
    pin: str
    must_change_credentials: bool = True


class UserStatusUpdate(BaseModel):
    is_active: bool


class CsvImportRequest(BaseModel):
    """CSV: name[,email][,username] por línea. PINs generados en lote."""

    csv_text: str = Field(min_length=1, max_length=500_000)


class CsvImportResult(BaseModel):
    created: int
    skipped: int
    pins: dict[str, str]


class AuditLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_id: int | None
    action: str
    entity_type: str | None
    entity_id: str | None
    course_id: int | None
    payload: dict[str, Any]
    ip: str | None
    created_at: datetime
    actor_name: str | None = None
