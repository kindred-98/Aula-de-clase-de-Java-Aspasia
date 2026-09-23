"""Crea el primer administrador.

Uso:
  AULA_ADMIN_EMAIL=admin@aula.test AULA_ADMIN_PASSWORD=... python -m scripts.create_admin
"""

from __future__ import annotations

import os
import sys

from sqlalchemy import select

from app.core.security import hash_secret
from app.db.session import SessionLocal
from app.models import User, UserRole


def create_admin(email: str, password: str, name: str = "Admin") -> User | None:
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters")
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            print(f"Admin already exists: {existing.email}")
            return existing
        user = User(
            name=name,
            email=email,
            role=UserRole.admin,
            password_hash=hash_secret(password),
            is_active=True,
            must_change_credentials=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created admin: {user.email} (id={user.id})")
        return user
    finally:
        db.close()


def main() -> None:
    email = os.environ.get("AULA_ADMIN_EMAIL", "admin@aula.test")
    password = os.environ.get("AULA_ADMIN_PASSWORD", "")
    if not password:
        print("Set AULA_ADMIN_PASSWORD (min 8 chars)", file=sys.stderr)
        raise SystemExit(1)
    create_admin(email, password)


if __name__ == "__main__":
    main()
