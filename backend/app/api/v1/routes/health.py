"""Endpoint de salud."""

from datetime import UTC, datetime

from fastapi import APIRouter

from app import __version__
from app.core.config import settings
from app.schemas import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=__version__,
        time=datetime.now(UTC),
    )
