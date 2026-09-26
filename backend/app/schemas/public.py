"""Esquemas públicos (Fase B): planes, alta de organización y activación."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import EmailLike


class PlanPublic(BaseModel):
    id: str
    name: str
    description: str
    price_eur: int = Field(ge=0)
    max_courses: int | None = None
    currency: str = "EUR"
    interval: str = "month"


class OrganizationRegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tax_id: str = Field(min_length=1, max_length=32)
    billing_email: EmailLike
    plan_id: str = Field(min_length=1, max_length=64)


class OrganizationRegisterResponse(BaseModel):
    organization_id: int
    checkout_url: str


class ActivationInfoResponse(BaseModel):
    email: str
    expires_at: datetime | None


class ActivationRequest(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    password: str = Field(min_length=8, max_length=128)


class ActivationResponse(BaseModel):
    status: str = "activated"
    email: str
