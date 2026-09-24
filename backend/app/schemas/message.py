"""Esquemas de mensajes (chat)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    recipient_id: int = Field(ge=1)
    body: str = Field(min_length=1, max_length=4000)
    course_id: int | None = Field(default=None, ge=1)


class MessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    recipient_id: int
    course_id: int | None
    body: str
    read_at: datetime | None
    created_at: datetime
    sender_name: str | None = None
    recipient_name: str | None = None


class ConversationSummary(BaseModel):
    user_id: int
    name: str
    role: str
    username: str | None = None
    email: str | None = None
    last_message: str
    last_at: datetime
    unread_count: int
