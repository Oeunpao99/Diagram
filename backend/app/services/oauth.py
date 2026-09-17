"""Social sign-in — verifying an identity provider's claim about who someone
is, without ever trusting the browser directly.

Google and GitHub use the standard "Authorization Code" redirect flow: the
frontend sends the browser to the provider and gets a short-lived `code`
back, which only this module ever exchanges (that needs the provider's
client secret, so it can't happen client-side). Telegram has no such
exchange — its Login Widget hands the frontend a payload signed with
HMAC-SHA256 over the bot token, and this module's job there is just to
recompute that signature before trusting anything in it.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import User
from app.schemas.auth import TelegramAuthRequest

_TELEGRAM_MAX_AGE_SECONDS = 24 * 60 * 60
_HTTP_TIMEOUT = 10.0


class OAuthError(Exception):
    """Anything about the exchange/verification itself went wrong — bad
    code, provider outage, a tampered Telegram payload. Routes turn this
    into a 400/502/501, never a bare 500."""


@dataclass
class ProviderProfile:
    provider: str
    provider_id: str
    email: str | None
    # Only a verified email is ever allowed to link onto an existing
    # password account — see upsert_oauth_user. Google says so explicitly;
    # GitHub only ever returns addresses it already considers verified.
    email_verified: bool
    name: str


async def exchange_google_code(code: str, redirect_uri: str) -> ProviderProfile:
    if not settings.google_client_id or not settings.google_client_secret:
        raise OAuthError("Google sign-in isn't configured.")

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise OAuthError("Google rejected that sign-in attempt.")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise OAuthError("Google didn't return an access token.")

        info_resp = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if info_resp.status_code != 200:
            raise OAuthError("Couldn't read the Google profile.")
        info = info_resp.json()

    sub = info.get("sub")
    if not sub:
        raise OAuthError("Google's profile had no user id.")
    return ProviderProfile(
        provider="google",
        provider_id=str(sub),
        email=info.get("email"),
        email_verified=bool(info.get("email_verified")),
        name=info.get("name") or info.get("email") or "Google user",
    )


async def exchange_github_code(code: str, redirect_uri: str) -> ProviderProfile:
    if not settings.github_client_id or not settings.github_client_secret:
        raise OAuthError("GitHub sign-in isn't configured.")

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "code": code,
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            raise OAuthError("GitHub rejected that sign-in attempt.")
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise OAuthError(token_data.get("error_description") or "GitHub didn't return an access token.")

        auth_headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
        }
        profile_resp = await client.get("https://api.github.com/user", headers=auth_headers)
        if profile_resp.status_code != 200:
            raise OAuthError("Couldn't read the GitHub profile.")
        profile = profile_resp.json()

        email = profile.get("email")
        if not email:
            # A private primary email is omitted from /user entirely — the
            # dedicated endpoint is the only way to still get it.
            emails_resp = await client.get("https://api.github.com/user/emails", headers=auth_headers)
            if emails_resp.status_code == 200:
                primary = next(
                    (e for e in emails_resp.json() if e.get("primary") and e.get("verified")),
                    None,
                )
                email = primary.get("email") if primary else None

    gh_id = profile.get("id")
    if not gh_id:
        raise OAuthError("GitHub's profile had no user id.")
    return ProviderProfile(
        provider="github",
        provider_id=str(gh_id),
        email=email,
        email_verified=bool(email),
        name=profile.get("name") or profile.get("login") or "GitHub user",
    )


def verify_telegram_payload(payload: TelegramAuthRequest) -> ProviderProfile:
    """Recomputes Telegram's documented HMAC check: sha256(bot token) as the
    key, over every non-empty field (excluding `hash` itself) as sorted
    `key=value` lines. https://core.telegram.org/widgets/login#checking-authorization"""
    if not settings.telegram_bot_token:
        raise OAuthError("Telegram sign-in isn't configured.")

    fields = {
        "auth_date": payload.auth_date,
        "first_name": payload.first_name,
        "id": payload.id,
        "last_name": payload.last_name,
        "photo_url": payload.photo_url,
        "username": payload.username,
    }
    check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(fields.items()) if value is not None
    )
    secret_key = hashlib.sha256(settings.telegram_bot_token.encode()).digest()
    expected = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, payload.hash):
        raise OAuthError("That Telegram sign-in couldn't be verified.")
    if time.time() - payload.auth_date > _TELEGRAM_MAX_AGE_SECONDS:
        raise OAuthError("That Telegram sign-in has expired — try again.")

    name = payload.first_name
    if payload.last_name:
        name = f"{name} {payload.last_name}"
    return ProviderProfile(
        provider="telegram",
        provider_id=str(payload.id),
        email=None,
        email_verified=False,
        name=name or payload.username or "Telegram user",
    )


async def upsert_oauth_user(db: AsyncSession, profile: ProviderProfile) -> User:
    """Resolve a verified provider profile to a local account: an existing
    identity link wins outright; failing that, a *verified* email match
    links this identity onto an existing password account; only then is a
    new account created. An unverified email is never trusted for anything
    here — not for linking, and not even for populating a new account's own
    email field, since it could just as easily collide with someone else's
    already-registered address (their real one)."""
    existing = (
        await db.execute(
            select(User).where(
                User.oauth_provider == profile.provider,
                User.oauth_id == profile.provider_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    verified_email = profile.email.strip().lower() if profile.email and profile.email_verified else None
    if verified_email:
        by_email = (
            await db.execute(select(User).where(func.lower(User.email) == verified_email))
        ).scalar_one_or_none()
        if by_email is not None:
            by_email.oauth_provider = profile.provider
            by_email.oauth_id = profile.provider_id
            await db.commit()
            await db.refresh(by_email)
            return by_email

    user = User(
        email=verified_email,
        name=profile.name[:120],
        password_hash=None,
        oauth_provider=profile.provider,
        oauth_id=profile.provider_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
