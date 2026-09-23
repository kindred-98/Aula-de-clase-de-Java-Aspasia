"""Esquemas de secciones y anuncios del curso."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import SectionKind


class SectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    order: int = Field(default=0, ge=0)
    kind: SectionKind = SectionKind.content
    body_markdown: str | None = None
    external_url: str | None = Field(default=None, max_length=500)


class SectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(
        default=None, min_length=1, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
    )
    order: int | None = Field(default=None, ge=0)
    kind: SectionKind | None = None
    body_markdown: str | None = None
    external_url: str | None = Field(default=None, max_length=500)


class SectionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    slug: str
    order: int
    kind: SectionKind
    body_markdown: str | None
    external_url: str | None


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body_markdown: str = ""


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body_markdown: str | None = None


class AnnouncementPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    author_id: int
    title: str
    body_markdown: str
    created_at: datetime
    author_name: str | None = None
