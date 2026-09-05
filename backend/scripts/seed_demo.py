import asyncio

from pwdlib import PasswordHash
from sqlalchemy import select

from app.db.session import engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.user import User
from app.models.enums import UserRole

password_hasher = PasswordHash.recommended()

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    password: str,
    role: UserRole,
):
    existing = await db.scalar(
        select(User).where(User.email == email)
    )

    if existing:
        existing.role = role
        existing.is_active = True
        existing.is_verified = True
        return existing

    user = User(
        email=email,
        full_name = "System",
        password_hash=password_hasher.hash(password),
        role=role,
        is_active=True,
        is_email_verified = True
    )

    db.add(user)
    return user


async def main():
    async with SessionLocal() as db:
        await get_or_create_user(
            db,
            "admin@dealflow.com",
            "admin@dealflow123",
            UserRole.ADMIN,
        )

        await get_or_create_user(
            db,
            "manager@dealflow.com",
            "manager@dealflow123",
            UserRole.SALES_MANAGER,
        )

        await get_or_create_user(
            db,
            "finance@dealflow.com",
            "finance@dealflow123",
            UserRole.FINANCE_OPS,
        )

        await get_or_create_user(
            db,
            "sales@dealflow.com",
            "Sales@@dealflow123",
            UserRole.SALES_REP,
        )

        await db.commit()

    print("DealFlow360 demo users ready.")


if __name__ == "__main__":
    asyncio.run(main())