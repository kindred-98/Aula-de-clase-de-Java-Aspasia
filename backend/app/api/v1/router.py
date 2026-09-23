"""Router v1."""

from fastapi import APIRouter

from app.api.v1.routes import (
    admin,
    announcements,
    auth,
    courses,
    health,
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

__all__ = ["api_router"]
