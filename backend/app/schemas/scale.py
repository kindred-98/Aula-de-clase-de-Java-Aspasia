"""Esquemas Fase D: categorías, cohorts, roles personalizados, sesiones."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

KNOWN_PERMISSIONS = [
    "reports.view",
    "settings.manage",
    "backup.export",
    "gradebook.view",
    "courses.manage",
    "users.manage",
]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    description: str | None = Field(default=None, max_length=2000)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(
        default=None, min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    description: str | None = Field(default=None, max_length=2000)


class CategoryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    created_at: datetime
    course_count: int = 0


class CohortCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=2, max_length=16, pattern=r"^[A-Za-z0-9_-]+$")
    category_id: int | None = None


class CohortPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    category_id: int | None
    created_at: datetime
    member_count: int = 0


class CohortMemberAdd(BaseModel):
    student_id: int | None = None
    student_ids: list[int] | None = None


class CohortMemberPublic(BaseModel):
    student_id: int
    name: str
    username: str | None


class CohortDetail(CohortPublic):
    members: list[CohortMemberPublic] = Field(default_factory=list)


class CourseTaxonomyUpdate(BaseModel):
    category_id: int | None = None
    cohort_id: int | None = None


class CourseTaxonomyPublic(BaseModel):
    course_id: int
    category_id: int | None
    cohort_id: int | None


class CustomRoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    permissions: list[str] = Field(default_factory=list)


class CustomRoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    permissions: list[str] | None = None


class CustomRolePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    permissions: list[str]
    created_at: datetime
    assigned_count: int = 0


class UserCustomRoleAssign(BaseModel):
    custom_role_id: int | None = None


class AutoEnrollResult(BaseModel):
    enrolled: int
    skipped: int
    reason: str | None = None


class ActiveSessionPublic(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_role: str
    created_at: datetime
    expires_at: datetime


class SessionRevokeRequest(BaseModel):
    user_id: int


class SessionRevokeResult(BaseModel):
    revoked: int


class UnlockResult(BaseModel):
    cleared_failures: int


class PermissionCatalog(BaseModel):
    permissions: list[str]
    effective: list[str]
