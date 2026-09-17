"""Register, sign in, and the account settings the UI exposes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.security import (
    create_access_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    OAuthCodeRequest,
    RegisterRequest,
    TelegramAuthRequest,
    TokenResponse,
    UpdateSettingsRequest,
    UserOut,
)
from app.services import oauth

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalise(email: str) -> str:
    return email.strip().lower()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = _normalise(payload.email)
    existing = (
        await db.execute(select(User).where(func.lower(User.email) == email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "That email is already registered.")

    user = User(
        email=email,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = _normalise(payload.email)
    user = (
        await db.execute(select(User).where(func.lower(User.email) == email))
    ).scalar_one_or_none()

    # Same message either way: don't help anyone enumerate registered emails.
    # A None hash is a Google/GitHub/Telegram-only account — verify_password
    # never sees it, since there's nothing valid it could ever match.
    if user is None or user.password_hash is None or not verify_password(
        payload.password, user.password_hash
    ):
        if user is not None and user.password_hash is None:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "This account signs in with Google, GitHub, or Telegram — use one of those instead.",
            )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    """The SPA calls this on boot to turn a stored token back into a session."""
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_settings(
    payload: UpdateSettingsRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(user, field, value.strip() if field == "name" else value)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.password_hash is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account doesn't have a password to change — it signs in "
            "with Google, GitHub, or Telegram.",
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is wrong.")
    user.password_hash = hash_password(payload.new_password)
    await db.commit()


async def _oauth_token_response(db: AsyncSession, profile: oauth.ProviderProfile) -> TokenResponse:
    user = await oauth.upsert_oauth_user(db, profile)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/google", response_model=TokenResponse)
async def login_google(payload: OAuthCodeRequest, db: AsyncSession = Depends(get_db)):
    try:
        profile = await oauth.exchange_google_code(payload.code, payload.redirect_uri)
    except oauth.OAuthError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return await _oauth_token_response(db, profile)


@router.post("/github", response_model=TokenResponse)
async def login_github(payload: OAuthCodeRequest, db: AsyncSession = Depends(get_db)):
    try:
        profile = await oauth.exchange_github_code(payload.code, payload.redirect_uri)
    except oauth.OAuthError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return await _oauth_token_response(db, profile)


@router.post("/telegram", response_model=TokenResponse)
async def login_telegram(payload: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        profile = oauth.verify_telegram_payload(payload)
    except oauth.OAuthError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return await _oauth_token_response(db, profile)
