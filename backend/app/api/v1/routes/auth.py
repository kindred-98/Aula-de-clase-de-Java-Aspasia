"""Endpoints de autenticación."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.schemas.auth import (
    ChangeCredentialsRequest,
    LoginStaffRequest,
    LoginStudentRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserPublic,
)
from app.security.policies import (
    CurrentUser,
    CurrentUserWithPendingChange,
    DbSession,
    current_user_from_token,
)
from app.services import auth_service
from app.services.auth_service import REFRESH_COOKIE_PATH, AuthError

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    secure = settings_secure()
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        samesite="strict",
        secure=secure,
        path=REFRESH_COOKIE_PATH,
        max_age=60 * 60 * 24 * 14,
    )


def settings_secure() -> bool:
    from app.core.config import settings

    return settings.environment == "production"


def _handle_auth_error(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post("/login/student", response_model=TokenResponse)
def login_student(
    body: LoginStudentRequest,
    request: Request,
    response: Response,
    db: DbSession,
) -> TokenResponse:
    ip = request.client.host if request.client else None
    try:
        _user, tokens = auth_service.login_student(
            db,
            course_code=body.course_code,
            identifier=body.identifier,
            pin=body.pin,
            ip=ip,
        )
    except AuthError as exc:
        raise _handle_auth_error(exc) from exc
    out = TokenResponse(**tokens)
    _set_refresh_cookie(response, out.refresh_token)
    return out


@router.post("/login/staff", response_model=TokenResponse)
def login_staff(
    body: LoginStaffRequest,
    request: Request,
    response: Response,
    db: DbSession,
) -> TokenResponse:
    ip = request.client.host if request.client else None
    try:
        _user, tokens = auth_service.login_staff(
            db, email=str(body.email), password=body.password, ip=ip
        )
    except AuthError as exc:
        raise _handle_auth_error(exc) from exc
    out = TokenResponse(**tokens)
    _set_refresh_cookie(response, out.refresh_token)
    return out


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    body: RefreshRequest,
    request: Request,
    response: Response,
    db: DbSession,
) -> TokenResponse:
    token = body.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        _user, tokens = auth_service.refresh_tokens(db, refresh_token=token)
    except AuthError as exc:
        raise _handle_auth_error(exc) from exc
    out = TokenResponse(**tokens)
    _set_refresh_cookie(response, out.refresh_token)
    return out


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    body: LogoutRequest,
    request: Request,
    response: Response,
    db: DbSession,
) -> Response:
    token = body.refresh_token or request.cookies.get(REFRESH_COOKIE)
    user = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            user = current_user_from_token(db, auth_header.removeprefix("Bearer ").strip())
        except HTTPException:
            user = None
    auth_service.logout(db, refresh_token=token, user=user)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserPublic)
def me(user: Annotated[object, Depends(CurrentUser)]) -> UserPublic:
    from app.models import User

    assert isinstance(user, User)
    return UserPublic.model_validate(user)


@router.patch("/change-credentials", response_model=UserPublic)
def change_credentials(
    body: ChangeCredentialsRequest,
    request: Request,
    db: DbSession,
    user: Annotated[object, Depends(CurrentUserWithPendingChange)],
) -> UserPublic:
    from app.models import User

    assert isinstance(user, User)
    ip = request.client.host if request.client else None
    try:
        updated = auth_service.change_credentials(
            db,
            user=user,
            current_secret=body.current_secret,
            new_secret=body.new_secret,
            ip=ip,
        )
    except AuthError as exc:
        raise _handle_auth_error(exc) from exc
    return UserPublic.model_validate(updated)
