from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.admin import (
    UserAdminResponse,
    UserRoleUpdate,
    UserStatusUpdate,
)

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
)


@router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.scalars(
        select(User).order_by(User.created_at.desc())
    )
    return list(result.all())


@router.patch(
    "/users/{user_id}/role",
    response_model=UserAdminResponse,
)
async def change_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = await db.get(User, user_id)

    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            400,
            "You cannot remove your own admin role.",
        )

    user.role = payload.role

    await db.commit()
    await db.refresh(user)

    return user


@router.patch(
    "/users/{user_id}/status",
    response_model=UserAdminResponse,
)
async def change_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = await db.get(User, user_id)

    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(
            400,
            "You cannot deactivate your own account.",
        )

    user.is_active = payload.is_active

    await db.commit()
    await db.refresh(user)

    return user