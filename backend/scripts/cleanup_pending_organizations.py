"""Borra organizaciones abandonadas en `pending_payment` (>7 días).

El alta pública crea la organización antes del Checkout; si nadie paga, la fila
queda huérfana. En producción se invoca con cron (el repo no tiene scheduler):

  python -m scripts.cleanup_pending_organizations
  python -m scripts.cleanup_pending_organizations --days 7

Nunca borra una organización con usuarios asociados.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Organization, OrgStatus, User

PENDING_ORG_CLEANUP_DAYS = 7


def cleanup_pending_organizations(
    db: Session, *, older_than_days: int = PENDING_ORG_CLEANUP_DAYS
) -> int:
    """Elimina organizaciones pending_payment antiguas sin usuarios. Devuelve cuáles."""
    cutoff = datetime.now(UTC) - timedelta(days=older_than_days)
    stale = db.scalars(
        select(Organization).where(
            Organization.status == OrgStatus.pending_payment,
            Organization.created_at < cutoff,
        )
    ).all()
    removed = 0
    for org in stale:
        has_users = db.scalar(select(User.id).where(User.organization_id == org.id))
        if has_users is not None:
            continue
        db.delete(org)
        removed += 1
    db.commit()
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--days",
        type=int,
        default=PENDING_ORG_CLEANUP_DAYS,
        help="Días mínimos en pending_payment antes de borrar (default: 7)",
    )
    args = parser.parse_args()
    db = SessionLocal()
    try:
        removed = cleanup_pending_organizations(db, older_than_days=args.days)
        print(f"Removed {removed} pending organization(s) older than {args.days} day(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
