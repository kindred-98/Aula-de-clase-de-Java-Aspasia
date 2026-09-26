"""Rutas públicas sin autenticación: catálogo de planes y alta de organización."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.models import Organization, OrgStatus
from app.schemas.public import (
    OrganizationRegisterRequest,
    OrganizationRegisterResponse,
    PlanPublic,
)
from app.security.policies import DbSession
from app.services.plans import PLANS, get_plan
from app.services.stripe_billing import StripeBillingError, create_checkout_session

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/plans", response_model=list[PlanPublic])
def list_plans() -> list[PlanPublic]:
    return [
        PlanPublic(
            id=plan.id,
            name=plan.name,
            description=plan.description,
            price_eur=plan.price_eur,
            max_courses=plan.max_courses,
        )
        for plan in PLANS
    ]


@router.post("/organizations", response_model=OrganizationRegisterResponse, status_code=201)
def register_organization(
    body: OrganizationRegisterRequest,
    db: DbSession,
) -> OrganizationRegisterResponse:
    plan = get_plan(body.plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.stripe_price_id:
        raise HTTPException(status_code=503, detail="Billing not configured for this plan")

    existing = db.scalar(
        select(Organization).where(Organization.billing_email == body.billing_email)
    )
    if existing is not None and existing.status is not OrgStatus.pending_payment:
        raise HTTPException(status_code=409, detail="Organization already registered")
    if existing is not None:
        org = existing
        org.name = body.name
        org.tax_id = body.tax_id
        org.plan_id = plan.id
    else:
        org = Organization(
            name=body.name,
            tax_id=body.tax_id,
            billing_email=body.billing_email,
            status=OrgStatus.pending_payment,
            plan_id=plan.id,
        )
        db.add(org)
        db.flush()

    try:
        checkout_url = create_checkout_session(org, plan)
    except StripeBillingError as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail="Stripe checkout error") from exc
    db.commit()
    db.refresh(org)
    return OrganizationRegisterResponse(organization_id=org.id, checkout_url=checkout_url)
