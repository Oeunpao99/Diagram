"""Shared route dependencies — currently just 'who is calling'."""

from __future__ import annotations

import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Diagram, User

_bearer = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not signed in.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise _UNAUTHORIZED

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise _UNAUTHORIZED from exc

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise _UNAUTHORIZED
    return user


async def diagram_access(
    db: AsyncSession, user: User, diagram_id: uuid.UUID, *, require_edit: bool = False
) -> tuple[Diagram, str]:
    """Resolves a diagram_id to (diagram, access) for this caller: 'owner' if
    they own it, or 'view'/'edit' if it's been shared with them at that role
    (Diagram.share_role — see /diagrams/{id}/share) — the same distinction
    the frontend uses to decide whether to show the editing tools at all.
    Anything else 404s, deliberately not 403, so a guessed id can't be used
    to confirm a diagram exists that isn't the caller's."""
    diagram = (
        await db.execute(select(Diagram).where(Diagram.id == diagram_id))
    ).scalar_one_or_none()
    if diagram is None:
        raise HTTPException(404, "Diagram not found.")
    if diagram.owner_id == user.id:
        return diagram, "owner"
    if diagram.share_role and (diagram.share_role == "edit" or not require_edit):
        return diagram, diagram.share_role
    raise HTTPException(404, "Diagram not found.")
