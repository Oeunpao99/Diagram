"""What AI actions cost, what packs sell, and the only code that changes a
user's credit balance.

Every change is one conditional UPDATE ... RETURNING, never "read the
balance, then write a new one", so two requests racing for the last credit
can't both win, and a payment polled from two tabs can't credit twice.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Payment, User

# --- what things cost ---------------------------------------------------------
# Layout, validation, moving/restyling shapes and exporting are free — they
# never call the model. improve-prompt and route are cheap helper calls that
# always run alongside a charged action, so they're free too rather than
# double-charging one diagram.
COSTS: dict[str, int] = {
    "generate": 1,
    "agent": 1,
    "edit": 1,
    "restyle": 1,
    "icon": 1,
    "explain": 1,
    "analyze_image": 2,
    "documentation": 2,
}


@dataclass(frozen=True)
class Pack:
    id: str
    name: str
    credits: int
    amount_cents: int
    currency: str = "USD"


# Named after the pricing slide: Dot (free) / Line / Shape / Masterpiece (sales).
PACKS: dict[str, Pack] = {
    "line": Pack(id="line", name="Line", credits=100, amount_cents=300),
    "shape": Pack(id="shape", name="Shape", credits=400, amount_cents=900),
}


class OutOfCredits(HTTPException):
    def __init__(self, needed: int, balance: int):
        super().__init__(
            status_code=402,
            detail=(
                f"You're out of credits — this needs {needed} and you have {balance}. "
                "Top up to keep going."
            ),
            headers={"X-Credits": str(balance)},
        )


@dataclass
class Charge:
    """A spend that has already been committed. Holds the user id itself so a
    refund never needs the (possibly expired) User object."""

    user_id: uuid.UUID
    action: str
    balance: int

    async def refund(self, db: AsyncSession) -> None:
        self.balance = await refund(db, self.user_id, self.action)


async def charge(db: AsyncSession, user: User, action: str) -> Charge:
    """Take the cost of `action` from the user, committing at once so the
    spend sticks even if the AI call that follows takes minutes. Returns the
    committed Charge (new balance included); raises 402 if they can't afford it."""
    cost = COSTS[action]
    # Captured up front: a rollback expires `user`, and touching an expired
    # attribute under asyncio means a lazy load, which raises.
    user_id = user.id
    balance = (
        await db.execute(
            update(User)
            .where(User.id == user_id, User.credits >= cost)
            .values(credits=User.credits - cost)
            .returning(User.credits)
        )
    ).scalar_one_or_none()
    if balance is None:
        await db.rollback()
        current = (await db.get(User, user_id, populate_existing=True)).credits
        raise OutOfCredits(cost, current)
    await db.commit()
    return Charge(user_id=user_id, action=action, balance=balance)


async def refund(db: AsyncSession, user_id: uuid.UUID, action: str) -> int:
    """Give back a charge whose AI call failed — the user shouldn't pay for
    an error. Rolls back first: the failed call may have left the session
    mid-transaction."""
    await db.rollback()
    balance = (
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(credits=User.credits + COSTS[action])
            .returning(User.credits)
        )
    ).scalar_one()
    await db.commit()
    return balance


async def settle_payment(
    db: AsyncSession,
    payment: Payment,
    *,
    bakong_hash: str | None,
    payer_account: str | None,
) -> bool:
    """Mark a pending payment paid and add its credits, in one transaction.
    Returns False (and changes nothing) if it was already settled."""
    flipped = (
        await db.execute(
            update(Payment)
            .where(Payment.id == payment.id, Payment.status == "pending")
            .values(
                status="paid",
                paid_at=datetime.now(UTC),
                bakong_hash=bakong_hash,
                payer_account=payer_account,
            )
            .returning(Payment.id)
        )
    ).scalar_one_or_none()
    if flipped is None:
        await db.rollback()
        return False
    await db.execute(
        update(User)
        .where(User.id == payment.user_id)
        .values(credits=User.credits + payment.credits)
    )
    await db.commit()
    return True
