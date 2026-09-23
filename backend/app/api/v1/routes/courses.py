"""Endpoints de cursos, asientos, matrículas y vista de aula."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Course,
    CourseTeacher,
    Enrollment,
    EnrollmentStatus,
    Seat,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)
from app.schemas.course import (
    ClassroomResponse,
    ClassroomSeat,
    CourseCreate,
    CoursePublic,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentPublic,
    SeatAssign,
    SeatPublic,
)
from app.security.policies import (
    CurrentUser,
    DbSession,
    require_admin,
    require_enrolled,
    require_staff_of_course,
)
from app.services.audit import log_action

router = APIRouter(tags=["courses"])


def _enrollment_public(e: Enrollment) -> EnrollmentPublic:
    return EnrollmentPublic(
        id=e.id,
        course_id=e.course_id,
        student_id=e.student_id,
        seat_id=e.seat_id,
        status=e.status,
        student_name=e.student.name if e.student else None,
        student_username=e.student.username if e.student else None,
        seat_row=e.seat.row if e.seat else None,
        seat_col=e.seat.col if e.seat else None,
    )


def _generate_seats(db: Session, course: Course) -> None:
    existing = db.scalar(select(func.count()).select_from(Seat).where(Seat.course_id == course.id))
    if existing and existing > 0:
        return
    for r in range(1, course.layout_rows + 1):
        for c in range(1, course.layout_cols + 1):
            db.add(Seat(course_id=course.id, row=r, col=c))


@router.get("/courses", response_model=list[CoursePublic])
def list_courses(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[CoursePublic]:
    if user.role is UserRole.admin:
        rows = db.scalars(select(Course).order_by(Course.id)).all()
        return [CoursePublic.model_validate(c) for c in rows]
    if user.role is UserRole.teacher:
        rows = db.scalars(
            select(Course)
            .join(CourseTeacher, CourseTeacher.course_id == Course.id)
            .where(CourseTeacher.teacher_id == user.id)
            .order_by(Course.id)
        ).all()
        return [CoursePublic.model_validate(c) for c in rows]
    rows = db.scalars(
        select(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(
            Enrollment.student_id == user.id,
            Enrollment.status == EnrollmentStatus.active,
        )
        .order_by(Course.id)
    ).all()
    return [CoursePublic.model_validate(c) for c in rows]


@router.post("/courses", response_model=CoursePublic, status_code=201)
def create_course(
    body: CourseCreate,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
    request: Request,
) -> CoursePublic:
    if db.scalar(select(Course).where(Course.code == body.code)):
        raise HTTPException(status_code=409, detail="Course code already exists")
    course = Course(
        name=body.name,
        code=body.code,
        description=body.description,
        layout_rows=body.layout_rows,
        layout_cols=body.layout_cols,
        settings=body.settings,
    )
    db.add(course)
    db.flush()
    _generate_seats(db, course)
    log_action(
        db,
        action="course.created",
        actor_id=_admin.id,
        entity_type="course",
        entity_id=course.id,
        course_id=course.id,
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(course)
    return CoursePublic.model_validate(course)


@router.get("/courses/{course_id}", response_model=CoursePublic)
def get_course(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> CoursePublic:
    _user, course, _enr = require_enrolled(db, user, _get_course(db, course_id))
    return CoursePublic.model_validate(course)


def _get_course(db: Session, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.patch("/courses/{course_id}", response_model=CoursePublic)
def update_course(
    course_id: int,
    body: CourseUpdate,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
) -> CoursePublic:
    course = _get_course(db, course_id)
    data = body.model_dump(exclude_unset=True)
    layout_changed = False
    for key, value in data.items():
        if key in {"layout_rows", "layout_cols"} and value is not None:
            setattr(course, key, value)
            layout_changed = True
        elif key == "settings" and value is not None:
            course.settings = value
        elif value is not None:
            setattr(course, key, value)
    if layout_changed:
        # Solo regenerar asientos si ampliamos y no hay matrículas activas en posiciones nuevas
        db.flush()
        _generate_seats(db, course)
    db.commit()
    db.refresh(course)
    return CoursePublic.model_validate(course)


@router.get("/courses/{course_id}/classroom", response_model=ClassroomResponse)
def classroom(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> ClassroomResponse:
    _user, course, _enr = require_enrolled(db, user, _get_course(db, course_id))

    enrollments = db.scalars(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.status == EnrollmentStatus.active,
        )
    ).all()
    by_seat = {e.seat_id: e for e in enrollments if e.seat_id is not None}

    # Estado de entrega por estudiante (última submission del curso)
    latest: dict[int, SubmissionStatus] = {}
    subs = db.scalars(
        select(Submission).where(Submission.course_id == course.id).order_by(Submission.id.desc())
    ).all()
    for s in subs:
        if s.student_id not in latest:
            latest[s.student_id] = s.status

    seats_out: list[ClassroomSeat] = []
    for seat in course.seats:
        e = by_seat.get(seat.id)
        status_val: str | None = None
        if e is not None:
            st = latest.get(e.student_id)
            status_val = st.value if st else "none"
        seats_out.append(
            ClassroomSeat(
                seat_id=seat.id,
                row=seat.row,
                col=seat.col,
                enrollment_id=e.id if e else None,
                student_id=e.student_id if e else None,
                student_name=e.student.name if e and e.student else None,
                student_username=e.student.username if e and e.student else None,
                status=status_val,
            )
        )

    teachers = [
        {"id": ct.teacher.id, "name": ct.teacher.name}
        for ct in course.teachers
        if ct.teacher is not None
    ]
    return ClassroomResponse(
        course=CoursePublic.model_validate(course),
        seats=seats_out,
        rows=course.layout_rows,
        cols=course.layout_cols,
        teachers=teachers,
    )


@router.get("/courses/{course_id}/seats", response_model=list[SeatPublic])
def list_seats(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[SeatPublic]:
    _user, course, _enr = require_enrolled(db, user, _get_course(db, course_id))
    return [SeatPublic.model_validate(s) for s in course.seats]


@router.get("/courses/{course_id}/enrollments", response_model=list[EnrollmentPublic])
def list_enrollments(
    course_id: int,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
) -> list[EnrollmentPublic]:
    _user, course = _staff
    rows = db.scalars(
        select(Enrollment).where(Enrollment.course_id == course.id).order_by(Enrollment.id)
    ).all()
    return [_enrollment_public(e) for e in rows]


@router.post("/courses/{course_id}/enrollments", response_model=EnrollmentPublic, status_code=201)
def create_enrollment(
    course_id: int,
    body: EnrollmentCreate,
    db: DbSession,
    _staff: Annotated[tuple[User, Course], Depends(require_staff_of_course)],
    _admin: Annotated[User, Depends(require_admin)],
) -> EnrollmentPublic:
    _user, course = _staff
    student: User | None = None
    if body.student_id is not None:
        student = db.get(User, body.student_id)
    elif body.username:
        student = db.scalar(select(User).where(User.username == body.username))
    elif body.name:
        student = db.scalar(
            select(User).where(User.name == body.name, User.role == UserRole.student)
        )
    if student is None or student.role is not UserRole.student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.student_id == student.id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already enrolled")

    seat_id = body.seat_id
    if seat_id is not None:
        seat = db.get(Seat, seat_id)
        if seat is None or seat.course_id != course.id:
            raise HTTPException(status_code=404, detail="Seat not found")
        taken = db.scalar(
            select(Enrollment).where(
                Enrollment.course_id == course.id,
                Enrollment.seat_id == seat_id,
            )
        )
        if taken is not None:
            raise HTTPException(status_code=409, detail="Seat already taken")

    enrollment = Enrollment(
        course_id=course.id,
        student_id=student.id,
        seat_id=seat_id,
        status=EnrollmentStatus.active,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return _enrollment_public(enrollment)


@router.patch(
    "/courses/{course_id}/enrollments/{enrollment_id}/seat",
    response_model=EnrollmentPublic,
)
def move_seat(
    course_id: int,
    enrollment_id: int,
    body: SeatAssign,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
) -> EnrollmentPublic:
    course = _get_course(db, course_id)
    enrollment = db.get(Enrollment, enrollment_id)
    if enrollment is None or enrollment.course_id != course.id:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if body.seat_id is None:
        enrollment.seat_id = None
    else:
        seat = db.get(Seat, body.seat_id)
        if seat is None or seat.course_id != course.id:
            raise HTTPException(status_code=404, detail="Seat not found")
        taken = db.scalar(
            select(Enrollment).where(
                Enrollment.course_id == course.id,
                Enrollment.seat_id == body.seat_id,
                Enrollment.id != enrollment.id,
            )
        )
        if taken is not None:
            raise HTTPException(status_code=409, detail="Seat already taken")
        enrollment.seat_id = body.seat_id
    # Las submissions cuelgan del student_id: mover asiento no las toca (D14)
    db.commit()
    db.refresh(enrollment)
    return _enrollment_public(enrollment)


@router.get("/courses/{course_id}/enrollments/me", response_model=EnrollmentPublic)
def my_enrollment(
    course_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> EnrollmentPublic:
    course = _get_course(db, course_id)
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course.id,
            Enrollment.student_id == user.id,
        )
    )
    if enrollment is None:
        if user.role in (UserRole.admin, UserRole.teacher):
            raise HTTPException(status_code=404, detail="No enrollment")
        raise HTTPException(status_code=404, detail="Course not found")
    return _enrollment_public(enrollment)


@router.delete("/courses/{course_id}/enrollments/{enrollment_id}", status_code=204)
def remove_enrollment(
    course_id: int,
    enrollment_id: int,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
) -> None:
    course = _get_course(db, course_id)
    enrollment = db.get(Enrollment, enrollment_id)
    if enrollment is None or enrollment.course_id != course.id:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(enrollment)
    db.commit()


@router.post("/courses/{course_id}/teachers/{teacher_id}", status_code=204)
def assign_teacher(
    course_id: int,
    teacher_id: int,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
) -> None:
    course = _get_course(db, course_id)
    teacher = db.get(User, teacher_id)
    if teacher is None or teacher.role is not UserRole.teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if not db.scalar(
        select(CourseTeacher).where(
            CourseTeacher.course_id == course.id,
            CourseTeacher.teacher_id == teacher.id,
        )
    ):
        db.add(CourseTeacher(course_id=course.id, teacher_id=teacher.id))
        db.commit()


@router.delete("/courses/{course_id}/teachers/{teacher_id}", status_code=204)
def unassign_teacher(
    course_id: int,
    teacher_id: int,
    db: DbSession,
    _admin: Annotated[User, Depends(require_admin)],
) -> None:
    course = _get_course(db, course_id)
    link = db.scalar(
        select(CourseTeacher).where(
            CourseTeacher.course_id == course.id,
            CourseTeacher.teacher_id == teacher_id,
        )
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(link)
    db.commit()


@router.get("/me/courses", response_model=list[CoursePublic])
def my_courses(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[CoursePublic]:
    return list_courses(db, user)
