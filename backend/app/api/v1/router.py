"""Router v1."""

from fastapi import APIRouter

from app.api.v1.routes import (
    admin,
    announcements,
    attendance,
    auth,
    calendar,
    course_chat,
    courses,
    health,
    messages,
    phase3,
    rubrics,
    sections,
    work,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(work.router)
api_router.include_router(sections.router)
api_router.include_router(announcements.router)
api_router.include_router(admin.router)
api_router.include_router(rubrics.router)
api_router.include_router(attendance.router)
api_router.include_router(calendar.router)
api_router.include_router(phase3.router)
api_router.include_router(messages.router)
api_router.include_router(course_chat.router)

__all__ = ["api_router"]
