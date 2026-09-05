import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings


password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def generate_otp() -> str:
    return f"{secrets.randbelow(100_000_000):08d}"


def hash_otp(code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(),
        code.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_otp(code: str, code_hash: str) -> bool:
    expected = hash_otp(code)
    return hmac.compare_digest(expected, code_hash)


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
        "jti": secrets.token_urlsafe(16),
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )