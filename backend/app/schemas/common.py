"""Esquemas Pydantic v2."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    app: str
    version: str
    time: datetime


class ErrorDetail(BaseModel):
    detail: str
