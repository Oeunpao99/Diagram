"""verify_telegram_payload's HMAC check, and upsert_oauth_user's account
resolution/linking policy — the two places a mistake here means either
rejecting a legitimate sign-in, or worse, accepting a forged one or attaching
an identity to the wrong local account.
"""

import hashlib
import hmac
import time
import uuid

import pytest

from app.core.config import settings
from app.models import User
from app.schemas.auth import TelegramAuthRequest
from app.services import oauth


def _signed_payload(**overrides) -> TelegramAuthRequest:
    fields = {
        "id": 987654321,
        "first_name": "Ada",
        "last_name": None,
        "username": "ada_tg",
        "photo_url": None,
        "auth_date": int(time.time()),
    }
    fields.update(overrides)
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()) if v is not None)
    secret_key = hashlib.sha256(settings.telegram_bot_token.encode()).digest()
    signature = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    return TelegramAuthRequest(**fields, hash=signature)


@pytest.fixture(autouse=True)
def _telegram_bot_token(monkeypatch):
    monkeypatch.setattr(settings, "telegram_bot_token", "test-bot-token-000")


def test_verify_telegram_payload_accepts_a_correctly_signed_payload():
    profile = oauth.verify_telegram_payload(_signed_payload())
    assert profile.provider == "telegram"
    assert profile.provider_id == "987654321"
    assert profile.email is None
    assert profile.name == "Ada"


def test_verify_telegram_payload_rejects_a_tampered_field():
    tampered = _signed_payload().model_copy(update={"first_name": "Eve"})
    with pytest.raises(oauth.OAuthError):
        oauth.verify_telegram_payload(tampered)


def test_verify_telegram_payload_rejects_a_stale_auth_date():
    stale = _signed_payload(auth_date=int(time.time()) - 90_000)  # > 24h
    with pytest.raises(oauth.OAuthError):
        oauth.verify_telegram_payload(stale)


def test_verify_telegram_payload_requires_a_configured_bot_token(monkeypatch):
    # Signed while a token is still configured — the point is that *checking*
    # it must refuse to run with none set, not that signing would fail too.
    payload = _signed_payload()
    monkeypatch.setattr(settings, "telegram_bot_token", None)
    with pytest.raises(oauth.OAuthError):
        oauth.verify_telegram_payload(payload)


async def test_upsert_oauth_user_creates_a_new_account(db):
    profile = oauth.ProviderProfile(
        provider="github",
        provider_id=f"gh-{uuid.uuid4()}",
        email=None,
        email_verified=False,
        name="Test Hubber",
    )
    user = None
    try:
        user = await oauth.upsert_oauth_user(db, profile)
        assert user.oauth_provider == "github"
        assert user.oauth_id == profile.provider_id
        assert user.password_hash is None
    finally:
        if user is not None:
            await db.delete(user)
            await db.commit()


async def test_upsert_oauth_user_reuses_the_existing_identity(db):
    profile = oauth.ProviderProfile(
        provider="google",
        provider_id=f"g-{uuid.uuid4()}",
        email=None,
        email_verified=False,
        name="Once",
    )
    first = None
    try:
        first = await oauth.upsert_oauth_user(db, profile)
        again = await oauth.upsert_oauth_user(db, profile)
        assert again.id == first.id
    finally:
        if first is not None:
            await db.delete(first)
            await db.commit()


async def test_upsert_oauth_user_links_a_verified_email_onto_an_existing_account(db):
    email = f"linktest-{uuid.uuid4()}@example.com"
    existing = User(email=email, name="Existing", password_hash="!locked")
    db.add(existing)
    await db.commit()
    await db.refresh(existing)

    profile = oauth.ProviderProfile(
        provider="google",
        provider_id=f"g-{uuid.uuid4()}",
        email=email,
        email_verified=True,
        name="Existing",
    )
    try:
        linked = await oauth.upsert_oauth_user(db, profile)
        assert linked.id == existing.id
        assert linked.oauth_provider == "google"
        # Linking attaches the identity without touching the password login
        # path — the account should still work the old way too.
        assert linked.password_hash == "!locked"
    finally:
        await db.delete(existing)
        await db.commit()


async def test_upsert_oauth_user_never_links_on_an_unverified_email(db):
    email = f"unverified-{uuid.uuid4()}@example.com"
    existing = User(email=email, name="Existing", password_hash="!locked")
    db.add(existing)
    await db.commit()
    await db.refresh(existing)

    profile = oauth.ProviderProfile(
        provider="google",
        provider_id=f"g-{uuid.uuid4()}",
        email=email,
        email_verified=False,
        name="Existing",
    )
    created = None
    try:
        created = await oauth.upsert_oauth_user(db, profile)
        assert created.id != existing.id
        assert created.oauth_provider == "google"
        # The unverified email is never stored, not even on the new account —
        # it would collide with `existing`'s row (the unique index) and,
        # more fundamentally, isn't trustworthy enough to claim at all.
        assert created.email is None
    finally:
        await db.delete(existing)
        if created is not None:
            await db.delete(created)
        await db.commit()
