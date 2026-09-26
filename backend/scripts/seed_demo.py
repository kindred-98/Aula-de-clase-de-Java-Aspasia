"""Seed de demo: curso Java 3x5, 1 profesora, 15 estudiantes.

Uso:  python -m scripts.seed_demo
Nunca se importa en codigo de produccion.
"""

from __future__ import annotations

import secrets
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_secret
from app.db.session import SessionLocal
from app.models import (
    Course,
    CourseStatus,
    CourseTeacher,
    Enrollment,
    Seat,
    Section,
    SectionKind,
    User,
    UserRole,
)

STUDENTS = [
    ("student01", "Alice"),
    ("student02", "Bob"),
    ("student03", "Carla"),
    ("student04", "Diego"),
    ("student05", "Elena"),
    ("student06", "Fernando"),
    ("student07", "Gabriela"),
    ("student08", "Hugo"),
    ("student09", "Irene"),
    ("student10", "Javier"),
    ("student11", "Karla"),
    ("student12", "Luis"),
    ("student13", "Marta"),
    ("student14", "Nora"),
    ("student15", "Omar"),
]

SECTIONS = [
    ("HTML", "html", SectionKind.content, "# HTML\n\nFundamentos de HTML."),
    ("CSS", "css", SectionKind.content, "# CSS\n\nEstilos y layout."),
    ("Java", "java", SectionKind.content, "# Java\n\nPOO y colecciones."),
    ("JS", "js", SectionKind.content, "# JavaScript\n\nAsincronía y DOM."),
    (
        "Información externa",
        "externa",
        SectionKind.external,
        None,
    ),
]


def _generate_pins(n: int) -> list[str]:
    return [f"{secrets.randbelow(1_000_000):06d}" for _ in range(n)]


def seed_demo(db: Session | None = None) -> dict[str, Any]:
    own = db is None
    session = db or SessionLocal()
    try:
        existing = session.scalar(select(Course).where(Course.code == "JAVA"))
        if existing is not None:
            return {"status": "exists", "course_id": existing.id}

        teacher = session.scalar(select(User).where(User.email == "profe@demo.test"))
        if teacher is None:
            teacher = User(
                name="Profesora Demo",
                email="profe@demo.test",
                role=UserRole.teacher,
                password_hash=hash_secret("profe-demo-pass"),
                is_active=True,
                must_change_credentials=False,
            )
            session.add(teacher)
            session.flush()

        course = Course(
            name="Java",
            code="JAVA",
            description="Clase de demostracion 3x5",
            status=CourseStatus.active,
            layout_rows=3,
            layout_cols=5,
            settings={"peer_visibility_default": "class"},
        )
        session.add(course)
        session.flush()

        session.add(CourseTeacher(course_id=course.id, teacher_id=teacher.id))

        seats: list[Seat] = []
        for r in range(1, 4):
            for c in range(1, 6):
                seat = Seat(course_id=course.id, row=r, col=c)
                session.add(seat)
                seats.append(seat)
        session.flush()

        pins = _generate_pins(len(STUDENTS))
        pin_map: dict[str, str] = {}
        for (username, name), pin in zip(STUDENTS, pins, strict=True):
            student = User(
                name=name,
                username=username,
                role=UserRole.student,
                pin_hash=hash_secret(pin),
                is_active=True,
                must_change_credentials=False,
            )
            session.add(student)
            session.flush()
            session.add(
                Enrollment(
                    course_id=course.id,
                    student_id=student.id,
                    seat_id=seats[len(pin_map)].id,
                )
            )
            pin_map[username] = pin

        for title, slug, kind, body in SECTIONS:
            existing_count = len(
                session.scalars(select(Section).where(Section.course_id == course.id)).all()
            )
            session.add(
                Section(
                    course_id=course.id,
                    title=title,
                    slug=slug,
                    order=existing_count,
                    kind=kind,
                    body_markdown=body if kind is SectionKind.content else None,
                    external_url="https://example.com" if kind is SectionKind.external else None,
                )
            )

        if own:
            session.commit()
        else:
            session.flush()

        return {
            "status": "created",
            "course_id": course.id,
            "code": course.code,
            "pins": pin_map,
            "teacher_email": "profe@demo.test",
            "teacher_password": "profe-demo-pass",
        }
    finally:
        if own:
            session.close()


def main() -> None:
    result = seed_demo()
    print(result)


if __name__ == "__main__":
    main()
