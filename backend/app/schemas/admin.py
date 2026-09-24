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


class AdminUserCreate(BaseModel):
    """Alta de usuario por el admin (admin o teacher; student preferible por CSV)."""

    name: str = Field(min_length=1, max_length=200)
    role: UserRole
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320)
    username: str | None = Field(default=None, min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    pin: str | None = Field(default=None, pattern=r"^\d{6}$")


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320)
    username: str | None = Field(default=None, min_length=1, max_length=100)
    role: UserRole | None = None
    is_active: bool | None = None


class AdminUserCreated(AdminUserPublic):
    """Alta con secreto temporal visible una sola vez."""

    temporary_secret: str | None = None


class StaffPasswordResetRequest(BaseModel):
    password: str | None = Field(default=None, min_length=8, max_length=128)


class StaffPasswordResetResponse(BaseModel):
    user_id: int
    password: str
    must_change_credentials: bool = True


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
