"""Credits and KHQR top-ups.

Flow: the client picks a pack -> POST /billing/checkout returns a KHQR to show
-> the client polls GET /billing/payments/{id} every few seconds while the QR
is on screen -> once Bakong reports the transaction, that same call credits
the account and answers status "paid" with the new balance.

Payment is confirmed by polling Bakong rather than by a webhook because
Bakong's open API has none; the poll is driven by the open payment window, so
nothing runs in the background when nobody is paying.

Bakong allows a standard token only ~100 requests a day, so the client may
poll this server as often as it likes but the server asks Bakong sparingly
(_due): every 15s for a QR's first two minutes, then once a minute, and not
at all for an hour after Bakong says the allowance is used up. Opening the
billing dialog re-checks the caller's recent pending payments, so a payment
made while checks were paused is still credited later.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import Payment, User
from app.services import bakong, khqr
from app.services.credits import COSTS, PACKS, settle_payment

log = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

# How long a QR can be paid. Bank apps refuse an expired KHQR themselves; the
# grace period covers a payment made in the last seconds that Bakong only
# reports a moment later.
QR_LIFETIME = timedelta(minutes=15)
SETTLE_GRACE = timedelta(minutes=5)

# How often we're willing to ask Bakong about one payment (see module doc).
FAST_PHASE = timedelta(minutes=2)
FAST_GAP = timedelta(seconds=15)
SLOW_GAP = timedelta(seconds=60)
FORCE_GAP = timedelta(seconds=5)  # "I've paid — check now"
LIMIT_PAUSE = timedelta(hours=1)
# Pending payments this recent are re-checked when the billing dialog opens.
RECHECK_WINDOW = timedelta(hours=48)

# In-process state. One API process serves the app, so a dict is enough; with
# several workers each would just keep its own (slightly more Bakong calls).
_last_checked: dict[uuid.UUID, datetime] = {}
_paused_until: datetime | None = None


class PackOut(BaseModel):
    id: str
    name: str
    credits: int
    amount_cents: int
    currency: str


class BillingOut(BaseModel):
    credits: int
    payments_enabled: bool
    packs: list[PackOut]
    costs: dict[str, int]


class CheckoutRequest(BaseModel):
    pack: str


class PaymentOut(BaseModel):
    id: uuid.UUID
    pack: str
    credits: int
    amount_cents: int
    currency: str
    status: Literal["pending", "paid", "expired"]
    qr: str
    merchant_name: str
    expires_at: datetime
    # True while Bakong can't be asked (daily allowance used up, or down): the
    # payment is still safe and will be credited once checks resume.
    check_delayed: bool = False
    # The account's balance after this check — lets the client update the
    # credit badge the moment a payment lands, without a second request.
    balance: int


def _packs() -> list[PackOut]:
    return [
        PackOut(
            id=p.id,
            name=p.name,
            credits=p.credits,
            amount_cents=p.amount_cents,
            currency=p.currency,
        )
        for p in PACKS.values()
    ]


async def _balance(db: AsyncSession, user_id: uuid.UUID) -> int:
    return (await db.get(User, user_id, populate_existing=True)).credits


def _out(payment: Payment, balance: int, *, delayed: bool = False) -> PaymentOut:
    return PaymentOut(
        id=payment.id,
        pack=payment.pack,
        credits=payment.credits,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        status=payment.status,  # type: ignore[arg-type]
        qr=payment.qr,
        merchant_name=settings.bakong_merchant_name,
        expires_at=payment.expires_at,
        check_delayed=delayed,
        balance=balance,
    )


def _due(payment: Payment, now: datetime, *, force: bool) -> bool:
    """Whether this poll should actually spend a Bakong request."""
    if _paused_until and now < _paused_until:
        return False
    last = _last_checked.get(payment.id)
    if last is None:
        return True
    if force:
        gap = FORCE_GAP
    elif now - payment.created_at < FAST_PHASE:
        gap = FAST_GAP
    else:
        gap = SLOW_GAP
    return now - last >= gap


async def _reconcile(db: AsyncSession, payment: Payment, *, force: bool = False) -> bool:
    """Ask Bakong about a pending payment if it's due, settling or expiring
    it on a definite answer. Returns True if the check is being held back
    (allowance used up / Bakong unreachable), so the client can say so."""
    global _paused_until
    if payment.status != "pending":
        return False
    now = datetime.now(UTC)
    if not _due(payment, now, force=force):
        return bool(_paused_until and now < _paused_until)
    _last_checked[payment.id] = now

    try:
        tx = await bakong.check_transaction(payment.md5)
    except bakong.BakongLimitError as exc:
        _paused_until = now + LIMIT_PAUSE
        log.error("Bakong allowance used up; pausing payment checks for an hour: %s", exc)
        return True
    except bakong.BakongError as exc:
        # Unknown, not "unpaid": leave it pending and never expire on this.
        log.warning("Bakong check failed for payment %s: %s", payment.id, exc)
        return True

    if tx is not None and _matches(payment, tx):
        await settle_payment(db, payment, bakong_hash=tx.hash, payer_account=tx.from_account)
        _last_checked.pop(payment.id, None)
    elif tx is not None:
        # Paid, but not what we asked for (wrong amount/account) — never
        # credit it; leave it pending and log it for a human to reconcile.
        log.error(
            "Payment %s md5 matched a transaction that doesn't match the order: %s",
            payment.id,
            tx,
        )
    elif now > payment.expires_at + SETTLE_GRACE:
        # Bakong said definitively: no such transaction, and the QR is dead.
        payment.status = "expired"
        await db.commit()
        _last_checked.pop(payment.id, None)
    await db.refresh(payment)
    return False


@router.get("", response_model=BillingOut)
async def billing(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    # Catch up on payments made while nobody was polling (window closed,
    # checks paused): opening the dialog is the natural moment to look.
    if settings.payments_enabled:
        recent = (
            await db.execute(
                select(Payment).where(
                    Payment.user_id == user.id,
                    Payment.status == "pending",
                    Payment.created_at > datetime.now(UTC) - RECHECK_WINDOW,
                )
            )
        ).scalars()
        for payment in list(recent):
            await _reconcile(db, payment)
    return BillingOut(
        credits=await _balance(db, user.id),
        payments_enabled=settings.payments_enabled,
        packs=_packs(),
        costs=COSTS,
    )


@router.post("/checkout", response_model=PaymentOut)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.payments_enabled:
        raise HTTPException(503, "Payments aren't set up on this server yet.")
    pack = PACKS.get(payload.pack)
    if pack is None:
        raise HTTPException(404, "No such pack.")

    payment_id = uuid.uuid4()
    merchant = khqr.Merchant(
        account_id=settings.bakong_account_id or "",
        name=settings.bakong_merchant_name[:25],
        city=settings.bakong_merchant_city[:15],
        account_info=settings.bakong_account_info,
        acquiring_bank=settings.bakong_acquiring_bank,
    )
    qr = khqr.build(
        merchant,
        amount_cents=pack.amount_cents,
        currency=pack.currency,
        # Shows on the merchant's statement, so a payment can be traced back.
        bill_number=payment_id.hex[:20],
        store_label="Kumnous",
        terminal_label=f"{pack.name} {pack.credits}cr"[:25],
        expires_in_seconds=int(QR_LIFETIME.total_seconds()),
    )
    payment = Payment(
        id=payment_id,
        user_id=user.id,
        pack=pack.id,
        credits=pack.credits,
        amount_cents=pack.amount_cents,
        currency=pack.currency,
        qr=qr,
        md5=khqr.md5(qr),
        status="pending",
        expires_at=datetime.now(UTC) + QR_LIFETIME,
    )
    db.add(payment)
    await db.commit()
    return _out(payment, await _balance(db, user.id))


@router.get("/payments/{payment_id}", response_model=PaymentOut)
async def payment_status(
    payment_id: uuid.UUID,
    force: bool = False,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    payment = (
        await db.execute(
            select(Payment).where(Payment.id == payment_id, Payment.user_id == user.id)
        )
    ).scalar_one_or_none()
    if payment is None:
        raise HTTPException(404, "Payment not found.")

    delayed = await _reconcile(db, payment, force=force)
    return _out(payment, await _balance(db, user.id), delayed=delayed)


def _matches(payment: Payment, tx: bakong.Transaction) -> bool:
    """The md5 already ties the transaction to our exact QR; this is a second
    check that the money went to us, in the right amount and currency."""
    if tx.amount is None or round(tx.amount * 100) != payment.amount_cents:
        return False
    if tx.currency and tx.currency.upper() != payment.currency:
        return False
    if tx.to_account and settings.bakong_account_id and tx.to_account != settings.bakong_account_id:
        return False
    return True
