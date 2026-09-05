from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    AuthUserResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services.auth import (
    authenticate_user,
    change_password,
    create_session,
    register_user,
    request_password_reset,
    reset_password,
    resend_verification,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_email,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])

bearer_scheme = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def set_refresh_cookie(
    response: Response,
    refresh_token: str,
):
    response.set_cookie(
        key="df_refresh",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key="df_refresh",
        path="/api/v1/auth",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = decode_access_token(credentials.credentials)

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

    except (InvalidTokenError, HTTPException):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user or not user.is_active or not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    success, message = await register_user(
        db,
        email=str(payload.email),
        full_name=payload.full_name,
        password=payload.password,
        ip_address=get_client_ip(request),
    )

    return MessageResponse(message=message)


@router.post(
    "/verify-email",
    response_model=MessageResponse,
)
async def verify_email_endpoint(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    verified = await verify_email(
        db,
        email=str(payload.email),
        otp=payload.otp,
    )

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code",
        )

    return MessageResponse(
        message="Email verified successfully. You can now log in."
    )


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
)
async def resend_verification_endpoint(
    payload: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await resend_verification(
        db,
        email=str(payload.email),
        ip_address=get_client_ip(request),
    )

    return MessageResponse(
        message="If the account requires verification, a new code will be sent."
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, result = await authenticate_user(
        db,
        email=str(payload.email),
        password=payload.password,
    )

    if result == "unverified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "EMAIL_NOT_VERIFIED",
                "message": "Please verify your email before logging in.",
            },
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token, refresh_token = await create_session(
        db,
        user=user,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    set_refresh_cookie(response, refresh_token)

    return AuthResponse(
        access_token=access_token,
        user=AuthUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_email_verified=user.is_email_verified,
        ),
    )

@router.post(
    "/refresh",
    response_model=RefreshResponse,
)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("df_refresh")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    result = await rotate_refresh_token(
        db,
        refresh_token=refresh_token,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    if not result:
        clear_refresh_cookie(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    access_token, new_refresh_token = result

    set_refresh_cookie(
        response,
        new_refresh_token,
    )

    return RefreshResponse(
        access_token=access_token,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("df_refresh")

    if refresh_token:
        await revoke_refresh_token(
            db,
            refresh_token,
        )

    clear_refresh_cookie(response)

    return MessageResponse(
        message="Logged out successfully."
    )

@router.get(
    "/me",
    response_model=AuthUserResponse,
)
async def get_me(
    user: User = Depends(get_current_user),
):
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_email_verified=user.is_email_verified,
    )

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await request_password_reset(
        db,
        email=str(payload.email),
        ip_address=get_client_ip(request),
    )

    return MessageResponse(
        message=(
            "If that email address is registered, "
            "a password reset code will be sent."
        )
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
)
async def reset_password_endpoint(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    success = await reset_password(
        db,
        email=str(payload.email),
        otp=payload.otp,
        new_password=payload.new_password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code",
        )

    return MessageResponse(
        message="Password reset successfully. Please log in again."
    )

@router.post(
    "/change-password",
    response_model=MessageResponse,
)
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    success = await change_password(
        db,
        user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    return MessageResponse(
        message="Password changed successfully. Please log in again."
    )
