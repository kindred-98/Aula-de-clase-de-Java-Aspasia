"""Modelo de organizaciones (tenants) del SaaS multi-tenant."""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OrgStatus(StrEnum):
    pending_payment = "pending_payment"  # checkout de Stripe iniciado, sin confirmar
    trialing = "trialing"
    active = "active"
    past_due = "past_due"
    canceled = "canceled"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(32), nullable=False)  # NIF/CIF
    billing_email: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[OrgStatus] = mapped_column(nullable=False, default=OrgStatus.active, index=True)
    plan_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
