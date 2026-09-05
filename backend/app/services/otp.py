from datetime import timedelta
from app.utils.time import utcnow
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import generate_otp, hash_otp, verify_otp
from app.models.otp import OTPCode


async def can_request_otp(
    db: AsyncSession,
    email: str,
    purpose: str,
    ip_address: str | None,
) -> tuple[bool, int]:
    now = utcnow()

    latest_result = await db.execute(
        select(OTPCode.created_at)
        .where(
            OTPCode.email == email,
            OTPCode.purpose == purpose,
        )
        .order_by(OTPCode.created_at.desc())
        .limit(1)
    )

    latest = latest_result.scalar_one_or_none()

    if latest:
        elapsed = (now - latest).total_seconds()

        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            retry_after = int(
                settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed
            )
            return False, max(retry_after, 1)

    hour_ago = now - timedelta(hours=1)

    email_count_result = await db.execute(
        select(func.count())
        .select_from(OTPCode)
        .where(
            OTPCode.email == email,
            OTPCode.purpose == purpose,
            OTPCode.created_at >= hour_ago,
        )
    )

    email_count = email_count_result.scalar_one()

    if email_count >= settings.OTP_MAX_REQUESTS_PER_HOUR:
        return False, 3600

    if ip_address:
        ip_count_result = await db.execute(
            select(func.count())
            .select_from(OTPCode)
            .where(
                OTPCode.requested_ip == ip_address,
                OTPCode.purpose == purpose,
                OTPCode.created_at >= hour_ago,
            )
        )

        ip_count = ip_count_result.scalar_one()

        if ip_count >= settings.OTP_MAX_REQUESTS_PER_HOUR * 3:
            return False, 3600

    return True, 0


async def create_otp(
    db: AsyncSession,
    *,
    email: str,
    purpose: str,
    user_id: str | None,
    ip_address: str | None,
) -> str:
    now = utcnow()

    await db.execute(
        delete(OTPCode).where(
            OTPCode.email == email,
            OTPCode.purpose == purpose,
            OTPCode.consumed_at.is_(None),
        )
    )

    code = generate_otp()

    otp = OTPCode(
        user_id=user_id,
        email=email,
        purpose=purpose,
        code_hash=hash_otp(code),
        expires_at=now + timedelta(
            minutes=settings.OTP_EXPIRE_MINUTES
        ),
        attempts=0,
        max_attempts=settings.OTP_MAX_ATTEMPTS,
        requested_ip=ip_address,
        created_at=now,
    )

    db.add(otp)

    return code


async def verify_otp_code(
    db: AsyncSession,
    *,
    email: str,
    purpose: str,
    code: str,
) -> OTPCode | None:
    now = utcnow()

    result = await db.execute(
        select(OTPCode)
        .where(
            OTPCode.email == email,
            OTPCode.purpose == purpose,
            OTPCode.consumed_at.is_(None),
        )
        .order_by(OTPCode.created_at.desc())
        .limit(1)
    )

    otp = result.scalar_one_or_none()

    if not otp:
        return None

    if otp.expires_at <= now:
        return None

    if otp.attempts >= otp.max_attempts:
        return None

    otp.attempts += 1

    if not verify_otp(code, otp.code_hash):
        return None

    otp.consumed_at = now

    return otp