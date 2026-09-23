"""upsert_oauth_user's account resolution/linking policy — the place a
mistake here means either accepting a forged identity or attaching one to
the wrong local account.
"""

import uuid

from app.models import User
from app.services import oauth


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
