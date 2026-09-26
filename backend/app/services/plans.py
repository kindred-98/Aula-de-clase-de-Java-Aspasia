"""Catálogo público de planes de suscripción (estático, sin tabla propia).

`stripe_price_id` viene de Settings (un Price de Stripe por plan); en
desarrollo puede estar vacío y el alta de organización responderá 503.
"""

from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    description: str
    price_eur: int
    max_courses: int | None  # None = ilimitado

    @property
    def stripe_price_id(self) -> str:
        return {
            "starter": settings.stripe_price_starter,
            "growth": settings.stripe_price_growth,
            "campus": settings.stripe_price_campus,
        }.get(self.id, "")


PLANS: tuple[Plan, ...] = (
    Plan(
        id="starter",
        name="Starter",
        description="Para academias que empiezan: hasta 3 cursos activos.",
        price_eur=29,
        max_courses=3,
    ),
    Plan(
        id="growth",
        name="Growth",
        description="Hasta 10 cursos activos con profesores ilimitados.",
        price_eur=79,
        max_courses=10,
    ),
    Plan(
        id="campus",
        name="Campus",
        description="Cursos ilimitados y soporte prioritario.",
        price_eur=149,
        max_courses=None,
    ),
)


def get_plan(plan_id: str) -> Plan | None:
    return next((p for p in PLANS if p.id == plan_id), None)
