"""Request/response bodies for the auth and settings endpoints."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Theme = Literal["system", "light", "dark"]
Accent = Literal["emerald", "violet", "blue", "amber", "rose"]


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name cannot be blank.")
        return stripped


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OAuthCodeRequest(BaseModel):
    """Google/GitHub: the redirect callback's `code`, exchanged server-side
    for the user's profile. `redirect_uri` must match the one the browser was
    actually sent to — both providers check it against the code themselves,
    so a mismatch fails the exchange rather than silently ignoring it."""

    code: str
    redirect_uri: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr | None
    name: str
    theme: Theme
    accent: Accent

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UpdateSettingsRequest(BaseModel):
    """Everything optional — the settings page sends only what changed."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    theme: Theme | None = None
    accent: Accent | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)
