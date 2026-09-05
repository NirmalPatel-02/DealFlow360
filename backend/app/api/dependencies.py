from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.models.enums import UserRole
from app.models.user import User
from app.api.v1.auth import get_current_user


def require_roles(*allowed_roles: UserRole) -> Callable:
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return checker


require_internal_user = require_roles(
    UserRole.SALES_REP,
    UserRole.SALES_MANAGER,
    UserRole.FINANCE_OPS,
    UserRole.ADMIN,
)

require_customer_management = require_roles(
    UserRole.SALES_REP,
    UserRole.SALES_MANAGER,
    UserRole.ADMIN,
)

require_admin = require_roles(UserRole.ADMIN)

require_manager = require_roles(UserRole.SALES_MANAGER, UserRole.ADMIN)

require_finance_ops = require_roles(
    UserRole.FINANCE_OPS,
    UserRole.ADMIN,
)