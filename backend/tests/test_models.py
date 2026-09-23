"""Tests de modelos y restricciones de integridad."""

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import (
    Assignment,
    AttendanceRecord,
    AttendanceStatus,
    AuditLog,
    Course,
    CourseStatus,
    Enrollment,
    Evaluation,
    Seat,
    Submission,
    User,
    UserRole,
    Visibility,
)


def _session() -> Session:
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    return Session(engine, expire_on_commit=False)


def test_all_tables_created() -> None:
    session = _session()
    assert set(Base.metadata.tables) == {
        "users",
        "refresh_tokens",
        "courses",
        "course_teachers",
        "seats",
        "enrollments",
        "sections",
        "assignments",
        "submissions",
        "submission_files",
        "evaluations",
        "announcements",
        "attendance_records",
        "audit_logs",
    }
    session.close()


def test_course_code_unique() -> None:
    session = _session()
    session.add(
        Course(
            name="Java",
            code="JAVA1",
            status=CourseStatus.active,
            layout_rows=3,
            layout_cols=5,
            settings={},
        )
    )
    session.commit()
    session.add(
        Course(
            name="Otro",
            code="JAVA1",
            status=CourseStatus.active,
            layout_rows=3,
            layout_cols=5,
            settings={},
        )
    )
    try:
        session.commit()
        raise AssertionError("duplicate code should fail")
    except IntegrityError:
        session.rollback()
    finally:
        session.close()


def test_seat_unique_position() -> None:
    session = _session()
    course = Course(
        name="Java",
        code="JAVA2",
        status=CourseStatus.active,
        layout_rows=3,
        layout_cols=5,
        settings={},
    )
    session.add(course)
    session.flush()
    session.add(Seat(course_id=course.id, row=0, col=0))
    session.commit()
    session.add(Seat(course_id=course.id, row=0, col=0))
    try:
        session.commit()
        raise AssertionError("duplicate seat should fail")
    except IntegrityError:
        session.rollback()
    finally:
        session.close()


def test_enrollment_unique_student_per_course() -> None:
    session = _session()
    course = Course(
        name="Java",
        code="JAVA3",
        status=CourseStatus.active,
        layout_rows=3,
        layout_cols=5,
        settings={},
    )
    student = User(name="Ana", role=UserRole.student, is_active=True, must_change_credentials=False)
    session.add_all([course, student])
    session.flush()
    session.add(Enrollment(course_id=course.id, student_id=student.id))
    session.commit()
    session.add(Enrollment(course_id=course.id, student_id=student.id))
    try:
        session.commit()
        raise AssertionError("duplicate enrollment should fail")
    except IntegrityError:
        session.rollback()
    finally:
        session.close()


def test_moving_seat_keeps_submissions() -> None:
    """Cambiar de asiento no debe perder entregas (asiento ≠ estudiante)."""
    session = _session()
    course = Course(
        name="Java",
        code="JAVA4",
        status=CourseStatus.active,
        layout_rows=3,
        layout_cols=5,
        settings={},
    )
    student = User(
        name="Luis", role=UserRole.student, is_active=True, must_change_credentials=False
    )
    session.add_all([course, student])
    session.flush()
    seat_a = Seat(course_id=course.id, row=0, col=0)
    seat_b = Seat(course_id=course.id, row=1, col=1)
    session.add_all([seat_a, seat_b])
    session.flush()
    enrollment = Enrollment(course_id=course.id, student_id=student.id, seat_id=seat_a.id)
    session.add(enrollment)
    session.flush()
    submission = Submission(course_id=course.id, student_id=student.id, notes="hola")
    session.add(submission)
    session.commit()
    submission_id = submission.id

    enrollment.seat_id = seat_b.id
    session.commit()

    kept = session.get(Submission, submission_id)
    assert kept is not None
    assert kept.student_id == student.id
    assert kept.notes == "hola"
    session.close()


def test_evaluation_is_append_only_rows() -> None:
    session = _session()
    course = Course(
        name="Java",
        code="JAVA5",
        status=CourseStatus.active,
        layout_rows=3,
        layout_cols=5,
        settings={},
    )
    student = User(name="Eva", role=UserRole.student, is_active=True, must_change_credentials=False)
    teacher = User(
        name="Profe",
        role=UserRole.teacher,
        email="p@x.io",
        password_hash="x",
        is_active=True,
        must_change_credentials=False,
    )
    session.add_all([course, student, teacher])
    session.flush()
    submission = Submission(course_id=course.id, student_id=student.id, notes="")
    session.add(submission)
    session.flush()
    e1 = Evaluation(
        submission_id=submission.id,
        teacher_id=teacher.id,
        score=70,
        comment_markdown="ok",
        rubric_scores={},
    )
    e2 = Evaluation(
        submission_id=submission.id,
        teacher_id=teacher.id,
        score=90,
        comment_markdown="mejor",
        rubric_scores={},
    )
    session.add_all([e1, e2])
    session.commit()
    assert len(submission.evaluations) == 2
    session.close()


def test_attendance_unique_per_day() -> None:
    from datetime import date

    session = _session()
    course = Course(
        name="Java",
        code="JAVA6",
        status=CourseStatus.active,
        layout_rows=3,
        layout_cols=5,
        settings={},
    )
    student = User(
        name="Sara", role=UserRole.student, is_active=True, must_change_credentials=False
    )
    session.add_all([course, student])
    session.flush()
    day = date(2026, 1, 12)
    session.add(
        AttendanceRecord(
            course_id=course.id, student_id=student.id, date=day, status=AttendanceStatus.present
        )
    )
    session.commit()
    session.add(
        AttendanceRecord(
            course_id=course.id, student_id=student.id, date=day, status=AttendanceStatus.absent
        )
    )
    try:
        session.commit()
        raise AssertionError("duplicate attendance should fail")
    except IntegrityError:
        session.rollback()
    finally:
        session.close()


def test_visibility_enum_values() -> None:
    assert Visibility.private.value == "private"
    assert Visibility.class_.value == "class"


def test_audit_log_action_index_exists() -> None:
    table = AuditLog.__table__
    assert any(col.name == "action" for col in table.columns)
    assert any([col.name for col in index.columns] == ["action"] for index in table.indexes)


def test_assignment_defaults() -> None:
    session = _session()
    course = Course(
        name="Java",
        code="JAVA7",
        status=CourseStatus.active,
        layout_rows=3,
        layout_cols=5,
        settings={},
    )
    teacher = User(
        name="Profe",
        role=UserRole.teacher,
        email="p2@x.io",
        password_hash="x",
        is_active=True,
        must_change_credentials=False,
    )
    session.add_all([course, teacher])
    session.flush()
    assignment = Assignment(
        course_id=course.id, title="T1", created_by=teacher.id, description_markdown="desc"
    )
    session.add(assignment)
    session.commit()
    assert assignment.visibility == Visibility.private
    assert float(assignment.max_score) == 100.0
    session.close()
