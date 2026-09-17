"""Shared fixtures for tests that need a real database session — the dev
Postgres started via `docker compose up -d db`, not a mock. `asyncio_mode =
"auto"` (pyproject.toml) means both async tests and async fixtures work with
a plain `async def`/`@pytest.fixture`, no extra markers needed."""

import pytest

from app.db.session import SessionLocal, engine


@pytest.fixture
async def db():
    async with SessionLocal() as session:
        yield session
    # `engine` is a module-level singleton bound to whichever event loop
    # existed when it was first created; pytest-asyncio hands each test its
    # own loop, so pooled asyncpg connections from a previous test's (now
    # closed) loop are unusable here. Disposing forces a fresh connection
    # under the *current* loop next time.
    await engine.dispose()
