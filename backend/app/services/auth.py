from datetime import datetime, timedelta, timezone
from uuid import uuid4
from app.utils.time import utcnow
import jwt
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.services.email import (
    send_password_changed_email,
    send_password_reset_otp,
    send_verification_otp,
)
from app.services.otp import can_request_otp, create_otp, verify_otp_code
from app.utils.email import normalize_email


async def register_user(
    db: AsyncSession,
    *,
    email: str,
    full_name: str,
    password: str,
    ip_address: str | None,
):
    email = normalize_email(email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if user:
        if user.is_email_verified:
            # Intentionally generic.
            return False, "If the account can be created, a verification email will be sent."

        allowed, retry_after = await can_request_otp(
            db,
            email,
            "email_verification",
            ip_address,
        )

        if not allowed:
            return False, f"Please wait before requesting another verification code."

        # Do NOT overwrite the password of an unverified account
        # merely because someone repeated registration.
        code = await create_otp(
            db,
            email=email,
            purpose="email_verification",
            user_id=user.id,
            ip_address=ip_address,
        )

        await db.commit()

        await send_verification_otp(email, code)

        return True, "If the account can be created, a verification email will be sent."

    password_hash = hash_password(password)

    user = User(
        email=email,
        full_name=full_name.strip(),
        password_hash=password_hash,
        role="sales_rep",
        is_active=True,
        is_email_verified=False,
    )

    db.add(user)

    await db.flush()

    allowed, _ = await can_request_otp(
        db,
        email,
        "email_verification",
        ip_address,
    )

    if not allowed:
        await db.rollback()
        return False, "Please try again later."

    code = await create_otp(
        db,
        email=email,
        purpose="email_verification",
        user_id=user.id,
        ip_address=ip_address,
    )

    await db.commit()

    email_sent = await send_verification_otp(email, code)

    if not email_sent:
        # Account remains unverified.
        # User can request resend later.
        return True, "Account created. Please request a verification code."

    return True, "Account created. Check your email for the verification code."


async def verify_email(
    db: AsyncSession,
    *,
    email: str,
    otp: str,
):
    email = normalize_email(email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user:
        return False

    if user.is_email_verified:
        return True

    otp_record = await verify_otp_code(
        db,
        email=email,
        purpose="email_verification",
        code=otp,
    )

    if not otp_record:
        await db.commit()
        return False

    user.is_email_verified = True

    await db.commit()

    return True


async def resend_verification(
    db: AsyncSession,
    *,
    email: str,
    ip_address: str | None,
):
    email = normalize_email(email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user or user.is_email_verified:
        return

    allowed, _ = await can_request_otp(
        db,
        email,
        "email_verification",
        ip_address,
    )

    if not allowed:
        return

    code = await create_otp(
        db,
        email=email,
        purpose="email_verification",
        user_id=user.id,
        ip_address=ip_address,
    )

    await db.commit()

    await send_verification_otp(email, code)


async def authenticate_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
):
    email = normalize_email(email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user:
        return None, "invalid"

    now = utcnow()

    if user.locked_until and user.locked_until > now:
        return None, "invalid"

    if user.locked_until and user.locked_until <= now:
        user.locked_until = None
        user.failed_login_attempts = 0

    valid_password = verify_password(
        password,
        user.password_hash,
    )

    if not valid_password:
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= settings.LOGIN_MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(
                minutes=settings.LOGIN_LOCKOUT_MINUTES
            )
            user.failed_login_attempts = 0

        await db.commit()

        return None, "invalid"

    if not user.is_active:
        return None, "invalid"

    if not user.is_email_verified:
        return None, "unverified"

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now

    await db.commit()

    return user, "success"


async def create_session(
    db: AsyncSession,
    *,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
):
    refresh_token = generate_refresh_token()

    session = RefreshSession(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        family_id=str(uuid4()),
        expires_at=utcnow()
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),        
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(session)

    await db.commit()

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    return access_token, refresh_token


async def rotate_refresh_token(
    db: AsyncSession,
    *,
    refresh_token: str,
    ip_address: str | None,
    user_agent: str | None,
):
    token_hash = hash_refresh_token(refresh_token)

    result = await db.execute(
        select(RefreshSession)
        .where(RefreshSession.token_hash == token_hash)
    )

    session = result.scalar_one_or_none()

    now = utcnow()

    if not session:
        return None

    if session.expires_at <= now:
        session.revoked_at = now
        await db.commit()
        return None

    if session.revoked_at:
        # Refresh-token reuse detection:
        # revoke the entire token family.
        await db.execute(
            update(RefreshSession)
            .where(
                RefreshSession.family_id == session.family_id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )

        await db.commit()
        return None

    session.revoked_at = now
    session.last_used_at = now

    new_refresh_token = generate_refresh_token()

    new_session = RefreshSession(
        user_id=session.user_id,
        token_hash=hash_refresh_token(new_refresh_token),
        family_id=session.family_id,
        expires_at=now + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        ),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(new_session)

    user_result = await db.execute(
        select(User).where(User.id == session.user_id)
    )

    user = user_result.scalar_one_or_none()

    if not user or not user.is_active or not user.is_email_verified:
        await db.rollback()
        return None

    await db.commit()

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    return access_token, new_refresh_token


async def revoke_refresh_token(
    db: AsyncSession,
    refresh_token: str,
):
    token_hash = hash_refresh_token(refresh_token)

    result = await db.execute(
        select(RefreshSession)
        .where(RefreshSession.token_hash == token_hash)
    )

    session = result.scalar_one_or_none()

    if session:
        session.revoked_at = utcnow()
        await db.commit()


async def request_password_reset(
    db: AsyncSession,
    *,
    email: str,
    ip_address: str | None,
):
    email = normalize_email(email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    # Deliberately do nothing if the account doesn't exist.
    if not user or not user.is_active or not user.is_email_verified:
        return

    allowed, _ = await can_request_otp(
        db,
        email,
        "password_reset",
        ip_address,
    )

    if not allowed:
        return

    code = await create_otp(
        db,
        email=email,
        purpose="password_reset",
        user_id=user.id,
        ip_address=ip_address,
    )

    await db.commit()

    await send_password_reset_otp(email, code)


async def reset_password(
    db: AsyncSession,
    *,
    email: str,
    otp: str,
    new_password: str,
):
    email = normalize_email(email)

    result = await db.execute(
        select(User).where(User.email == email)
    )

    user = result.scalar_one_or_none()

    if not user or not user.is_email_verified:
        return False

    otp_record = await verify_otp_code(
        db,
        email=email,
        purpose="password_reset",
        code=otp,
    )

    if not otp_record:
        await db.commit()
        return False

    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None

    # Important:
    # reset password invalidates all active refresh sessions.
    await db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )

    await db.commit()

    await send_password_changed_email(user.email)

    return True


async def change_password(
    db: AsyncSession,
    *,
    user: User,
    current_password: str,
    new_password: str,
):
    if not verify_password(
        current_password,
        user.password_hash,
    ):
        return False

    user.password_hash = hash_password(new_password)

    await db.execute(
        update(RefreshSession)
        .where(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )

    await db.commit()

    await send_password_changed_email(user.email)

    return True