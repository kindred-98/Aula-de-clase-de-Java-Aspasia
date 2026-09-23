"""Modelos de trabajo académico: tareas, entregas, archivos, evaluaciones."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User

try:
    from sqlalchemy.dialects.postgresql import JSONB

    JsonType = JSON().with_variant(JSONB(), "postgresql")
except ImportError:  # pragma: no cover
    JsonType = JSON()


class Visibility(StrEnum):
    private = "private"
    class_ = "class"


class SubmissionStatus(StrEnum):
    draft = "draft"
    submitted = "submitted"
    reviewed = "reviewed"
    needs_changes = "needs_changes"


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_id: Mapped[int | None] = mapped_column(
        ForeignKey("sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rubric_id: Mapped[int | None] = mapped_column(
        ForeignKey("rubrics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    max_score: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=Decimal("100.00")
    )
    visibility: Mapped[Visibility] = mapped_column(
        nullable=False, default=Visibility.private, index=True
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    course: Mapped["Course"] = relationship(lazy="joined")
    rubric: Mapped["Rubric | None"] = relationship(lazy="joined")


class Rubric(Base):
    """Plantilla de criterios de evaluación por curso (Fase 3)."""

    __tablename__ = "rubrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # [{ "id": "c1", "label": "Correctitud", "max": 40 }, ...]
    criteria: Mapped[list[dict[str, Any]]] = mapped_column(
        JsonType, nullable=False, default=list, server_default="[]"
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    course: Mapped["Course"] = relationship(lazy="joined")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    github_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[SubmissionStatus] = mapped_column(
        nullable=False, default=SubmissionStatus.draft, index=True
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    files: Mapped[list["SubmissionFile"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    evaluations: Mapped[list["Evaluation"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Evaluation.created_at.desc()",
    )
    student: Mapped["User"] = relationship(lazy="joined")
    assignment: Mapped[Assignment | None] = relationship(lazy="joined")


class SubmissionFile(Base):
    __tablename__ = "submission_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    submission: Mapped[Submission] = relationship(back_populates="files")


class Evaluation(Base):
    """Historial append-only: nunca se sobrescribe."""

    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    rubric_scores: Mapped[dict[str, Any]] = mapped_column(
        JsonType, nullable=False, default=dict, server_default="{}"
    )
    comment_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    submission: Mapped[Submission] = relationship(back_populates="evaluations")
    teacher: Mapped["User"] = relationship(lazy="joined")
