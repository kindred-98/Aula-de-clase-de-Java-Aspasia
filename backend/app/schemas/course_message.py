"""Esquemas del chat global por curso."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class CourseMessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    sender_id: int
    body: str
    created_at: datetime
    sender_name: str | None = None
    sender_role: str | None = None


class CourseChatPage(BaseModel):
    total: int
    unread: int
    items: list[CourseMessagePublic]


class CourseChatRoomSummary(BaseModel):
    course_id: int
    course_name: str
    course_code: str
    unread: int
    last_message: str | None = None
    last_at: datetime | None = None
    last_sender_name: str | None = None
