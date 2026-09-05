from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints, model_validator


Password = Annotated[
    str,
    StringConstraints(
        min_length=12,
        max_length=128,
    ),
]


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: Password


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{8}$")


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{8}$")
    new_password: Password
    confirm_password: Password

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password
    confirm_password: Password

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_email_verified: bool


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class MessageResponse(BaseModel):
    message: str