"""Router v1."""

from fastapi import APIRouter

from app.api.v1.routes import auth, courses, health, work

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(work.router)

__all__ = ["api_router"]
