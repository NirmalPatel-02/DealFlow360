from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: UserRole
    is_active: bool
    is_verified: bool


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserStatusUpdate(BaseModel):
    is_active: bool