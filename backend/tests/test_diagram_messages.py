"""The Copilot chat thread attached to a diagram: add/list round-trips,
/new's bulk clear, and that someone else's diagram 404s rather than leaking
whether it exists.
"""

import uuid

import pytest
from fastapi import HTTPException

from app.api.routes.diagrams import add_message, clear_messages, list_messages
from app.models import Diagram, User
from app.schemas.diagram import DiagramMessageCreate


async def _make_user_and_diagram(db):
    user = User(
        email=f"msgtest-{uuid.uuid4()}@example.com", name="Msg Tester", password_hash="!locked"
    )
    db.add(user)
    await db.flush()
    diagram = Diagram(owner_id=user.id, title="Test diagram", data={})
    db.add(diagram)
    await db.commit()
    await db.refresh(user)
    await db.refresh(diagram)
    return user, diagram


async def test_add_and_list_messages_round_trip(db):
    user, diagram = await _make_user_and_diagram(db)
    try:
        await add_message(
            diagram.id, DiagramMessageCreate(role="user", text="Add a rejection path"), user, db
        )
        await add_message(
            diagram.id,
            DiagramMessageCreate(role="ai", text="Done", changes=["Added X"]),
            user,
            db,
        )
        out = await list_messages(diagram.id, user, db)
        assert [m.role for m in out] == ["user", "ai"]
        assert out[0].text == "Add a rejection path"
        assert out[1].changes == ["Added X"]
        # Oldest first — the order a restored conversation should replay in.
        assert out[0].created_at <= out[1].created_at
    finally:
        await db.delete(diagram)
        await db.delete(user)
        await db.commit()


async def test_clear_messages_removes_all_of_them(db):
    user, diagram = await _make_user_and_diagram(db)
    try:
        await add_message(diagram.id, DiagramMessageCreate(role="user", text="hi"), user, db)
        await clear_messages(diagram.id, user, db)
        assert await list_messages(diagram.id, user, db) == []
    finally:
        await db.delete(diagram)
        await db.delete(user)
        await db.commit()


async def test_messages_404_for_a_diagram_you_dont_own(db):
    owner, diagram = await _make_user_and_diagram(db)
    stranger = User(
        email=f"stranger-{uuid.uuid4()}@example.com", name="Stranger", password_hash="!locked"
    )
    db.add(stranger)
    await db.commit()
    await db.refresh(stranger)
    try:
        with pytest.raises(HTTPException) as exc_info:
            await list_messages(diagram.id, stranger, db)
        assert exc_info.value.status_code == 404
    finally:
        await db.delete(diagram)
        await db.delete(owner)
        await db.delete(stranger)
        await db.commit()
