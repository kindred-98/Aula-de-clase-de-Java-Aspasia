"""Esquemas de autenticación."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.user import UserRole

# Formato de email sin rechazar dominios special-use (.test, .local) en dev/tests
EmailLike = Annotated[
    str,
    StringConstraints(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320),
]


class LoginStudentRequest(BaseModel):
    course_code: str = Field(min_length=1, max_length=16)
    identifier: str = Field(min_length=1, max_length=100)
    pin: str = Field(min_length=6, max_length=64, pattern=r"^\d{6,}$")


class LoginStaffRequest(BaseModel):
    email: EmailLike
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    """Login/refresh: el refresh token vive solo en la cookie httponly."""

    access_token: str
    token_type: str = Field(default="bearer")
    must_change_credentials: bool


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ChangeCredentialsRequest(BaseModel):
    """Cambio obligatorio en primer acceso (PIN de estudiante o contraseña staff)."""

    current_secret: str = Field(min_length=6, max_length=128)
    new_secret: str = Field(min_length=6, max_length=128)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str | None
    username: str | None
    role: UserRole
    is_active: bool
    must_change_credentials: bool
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    """Actualización de perfil propio (nombre y/o email)."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320)
