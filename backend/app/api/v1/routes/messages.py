"""Chat 1:1: conversaciones y envío de mensajes."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import Course, CourseTeacher, Enrollment, EnrollmentStatus, Message, User, UserRole
from app.schemas.message import ConversationSummary, MessageCreate, MessagePublic
from app.security.policies import CurrentUser, DbSession
from app.services.audit import log_action

router = APIRouter(prefix="/messages", tags=["messages"])


def _message_public(m: Message) -> MessagePublic:
    return MessagePublic(
        id=m.id,
        sender_id=m.sender_id,
        recipient_id=m.recipient_id,
        course_id=m.course_id,
        body=m.body,
        read_at=m.read_at,
        created_at=m.created_at,
        sender_name=m.sender.name if m.sender else None,
        recipient_name=m.recipient.name if m.recipient else None,
    )


def _can_message(db: Session, sender: User, recipient: User) -> None:
    if recipient.id == sender.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")
    if not recipient.is_active:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if sender.role is UserRole.admin:
        return
    if sender.role is UserRole.teacher:
        if recipient.role is UserRole.admin:
            return
        if recipient.role is UserRole.student:
            shared = db.scalar(
                select(Enrollment.id)
                .join(CourseTeacher, CourseTeacher.course_id == Enrollment.course_id)
                .where(
                    CourseTeacher.teacher_id == sender.id,
                    Enrollment.student_id == recipient.id,
                    Enrollment.status == EnrollmentStatus.active,
                )
                .limit(1)
            )
            if shared is None:
                raise HTTPException(status_code=403, detail="Not allowed to message this user")
            return
    # student
    if recipient.role is UserRole.admin:
        return
    if recipient.role is UserRole.teacher:
        shared = db.scalar(
            select(CourseTeacher.id)
            .join(Enrollment, Enrollment.course_id == CourseTeacher.course_id)
            .where(
                CourseTeacher.teacher_id == recipient.id,
                Enrollment.student_id == sender.id,
                Enrollment.status == EnrollmentStatus.active,
            )
            .limit(1)
        )
        if shared is None:
            raise HTTPException(status_code=403, detail="Not allowed to message this user")
        return
    raise HTTPException(status_code=403, detail="Not allowed to message this user")


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[ConversationSummary]:
    """Hilo más reciente con cada interlocutor + no leídos (portable SQLite/PG)."""
    rows = db.scalars(
        select(Message)
        .where(or_(Message.sender_id == user.id, Message.recipient_id == user.id))
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(500)
    ).all()

    latest_by_partner: dict[int, Message] = {}
    for msg in rows:
        other_id = msg.recipient_id if msg.sender_id == user.id else msg.sender_id
        if other_id not in latest_by_partner:
            latest_by_partner[other_id] = msg

    out: list[ConversationSummary] = []
    for other_id, msg in latest_by_partner.items():
        other = db.get(User, other_id)
        if other is None:
            continue
        unread = int(
            db.scalar(
                select(func.count())
                .select_from(Message)
                .where(
                    Message.sender_id == other_id,
                    Message.recipient_id == user.id,
                    Message.read_at.is_(None),
                )
            )
            or 0
        )
        out.append(
            ConversationSummary(
                user_id=other.id,
                name=other.name,
                role=other.role.value,
                username=other.username,
                email=other.email,
                last_message=msg.body[:200],
                last_at=msg.created_at,
                unread_count=unread,
            )
        )
    out.sort(key=lambda c: c.last_at, reverse=True)
    return out[:100]


@router.get("/{user_id}", response_model=list[MessagePublic])
def thread_with(
    user_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> list[MessagePublic]:
    other = db.get(User, user_id)
    if other is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Ver el hilo: cualquiera de los dos lados; no hace falta relation previa
    rows = db.scalars(
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == user.id, Message.recipient_id == user_id),
                and_(Message.sender_id == user_id, Message.recipient_id == user.id),
            )
        )
        .order_by(Message.created_at.asc(), Message.id.asc())
        .limit(500)
    ).all()
    return [_message_public(m) for m in rows]


@router.post("", response_model=MessagePublic, status_code=201)
def send_message(
    body: MessageCreate,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
    request: Request,
) -> MessagePublic:
    recipient = db.get(User, body.recipient_id)
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")
    _can_message(db, user, recipient)
    if body.course_id is not None:
        course = db.get(Course, body.course_id)
        if course is None:
            raise HTTPException(status_code=404, detail="Course not found")
    msg = Message(
        sender_id=user.id,
        recipient_id=recipient.id,
        course_id=body.course_id,
        body=body.body.strip(),
    )
    db.add(msg)
    log_action(
        db,
        action="message.sent",
        actor_id=user.id,
        entity_type="message",
        entity_id="new",
        course_id=body.course_id,
        payload={"recipient_id": recipient.id},
        ip=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(msg)
    return _message_public(msg)


@router.post("/{user_id}/read", status_code=204)
def mark_read(
    user_id: int,
    db: DbSession,
    user: Annotated[User, Depends(CurrentUser)],
) -> None:
    rows = db.scalars(
        select(Message).where(
            Message.sender_id == user_id,
            Message.recipient_id == user.id,
            Message.read_at.is_(None),
        )
    ).all()
    now = datetime.now(UTC)
    for m in rows:
        m.read_at = now
    if rows:
        db.commit()
