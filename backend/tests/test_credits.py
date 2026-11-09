"""Credits: spending, the 402 when you can't afford something, refunds, and
that a KHQR payment credits once — however often it's polled — and only when
Bakong's transaction matches the order."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

from app.api.routes import billing
from app.core.config import settings
from app.db.session import SessionLocal
from app.models import Payment, User
from app.services import bakong, credits


@pytest.fixture(autouse=True)
def _fresh_throttle(monkeypatch):
    """Each test starts with no remembered checks and no limit pause."""
    monkeypatch.setattr(billing, "_last_checked", {})
    monkeypatch.setattr(billing, "_paused_until", None)
    monkeypatch.setattr(settings, "bakong_account_id", settings.bakong_account_id or "kumnous@aclb")
    monkeypatch.setattr(settings, "bakong_api_token", settings.bakong_api_token or "test-token")


async def _user(db, balance: int | None = None) -> User:
    user = User(email=f"credits-{uuid.uuid4()}@example.com", name="Credit Tester")
    if balance is not None:
        user.credits = balance
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _balance(db, user_id) -> int:
    return (await db.get(User, user_id, populate_existing=True)).credits


async def _cleanup(db, user_id):
    await db.rollback()
    await db.execute(delete(Payment).where(Payment.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()


async def test_new_accounts_get_signup_credits(db):
    user = await _user(db)
    try:
        assert user.credits == settings.signup_credits
    finally:
        await _cleanup(db, user.id)


async def test_charge_refund_and_out_of_credits(db):
    user = await _user(db, balance=3)
    user_id = user.id
    try:
        charge = await credits.charge(db, user, "analyze_image")  # costs 2
        assert charge.balance == 1
        await charge.refund(db)
        assert charge.balance == 3
        assert await _balance(db, user_id) == 3

        await credits.charge(db, user, "documentation")  # 3 -> 1
        with pytest.raises(credits.OutOfCredits) as info:
            await credits.charge(db, user, "documentation")  # needs 2, has 1
        assert info.value.status_code == 402
        assert info.value.headers["X-Credits"] == "1"
        assert await _balance(db, user_id) == 1  # a refused charge takes nothing
    finally:
        await _cleanup(db, user_id)


async def test_concurrent_charges_cannot_overspend(db):
    user = await _user(db, balance=1)
    user_id = user.id

    async def attempt() -> bool:
        async with SessionLocal() as session:
            u = await session.get(User, user_id)
            try:
                await credits.charge(session, u, "generate")
                return True
            except credits.OutOfCredits:
                return False

    try:
        results = await asyncio.gather(*(attempt() for _ in range(5)))
        assert results.count(True) == 1
        assert await _balance(db, user_id) == 0
    finally:
        await _cleanup(db, user_id)


async def _pending_payment(db, user_id, *, expired=False) -> Payment:
    payment = Payment(
        user_id=user_id,
        pack="line",
        credits=100,
        amount_cents=300,
        currency="USD",
        qr="test-qr",
        md5=uuid.uuid4().hex,
        status="pending",
        expires_at=datetime.now(UTC) + (timedelta(hours=-1) if expired else timedelta(minutes=15)),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


def _tx(amount=3.0, currency="USD", to=None):
    return bakong.Transaction(
        hash="h", from_account="payer@abaa", to_account=to, currency=currency, amount=amount
    )


async def test_paid_payment_credits_exactly_once(db, monkeypatch):
    user = await _user(db, balance=0)
    user_id = user.id
    try:
        payment = await _pending_payment(db, user_id)

        async def paid(_md5):
            return _tx(to=settings.bakong_account_id)

        monkeypatch.setattr(bakong, "check_transaction", paid)
        first = await billing.payment_status(payment.id, user=user, db=db)
        second = await billing.payment_status(payment.id, user=user, db=db)
        assert first.status == "paid" and second.status == "paid"
        assert second.balance == 100
        assert await _balance(db, user_id) == 100
        stored = (await db.execute(select(Payment).where(Payment.id == payment.id))).scalar_one()
        assert stored.payer_account == "payer@abaa"
    finally:
        await _cleanup(db, user_id)


@pytest.mark.parametrize(
    "tx",
    [_tx(amount=0.3), _tx(currency="KHR"), _tx(to="someone-else@aclb")],
    ids=["wrong-amount", "wrong-currency", "wrong-account"],
)
async def test_mismatched_transaction_never_credits(db, monkeypatch, tx):
    user = await _user(db, balance=0)
    user_id = user.id
    try:
        payment = await _pending_payment(db, user_id)

        async def paid(_md5):
            return tx

        monkeypatch.setattr(bakong, "check_transaction", paid)
        # Pretend payments are configured so the account check can apply.
        monkeypatch.setattr(settings, "bakong_account_id", "kumnous@aclb")
        out = await billing.payment_status(payment.id, user=user, db=db)
        assert out.status == "pending"
        assert await _balance(db, user_id) == 0
    finally:
        await _cleanup(db, user_id)


async def test_unpaid_payment_expires_after_grace(db, monkeypatch):
    user = await _user(db, balance=0)
    user_id = user.id
    try:
        payment = await _pending_payment(db, user_id, expired=True)

        async def unpaid(_md5):
            return None

        monkeypatch.setattr(bakong, "check_transaction", unpaid)
        out = await billing.payment_status(payment.id, user=user, db=db)
        assert out.status == "expired"
        assert await _balance(db, user_id) == 0
    finally:
        await _cleanup(db, user_id)


async def test_bakong_outage_leaves_payment_pending(db, monkeypatch):
    user = await _user(db, balance=0)
    user_id = user.id
    try:
        payment = await _pending_payment(db, user_id)

        async def down(_md5):
            raise bakong.BakongError("unreachable")

        monkeypatch.setattr(bakong, "check_transaction", down)
        out = await billing.payment_status(payment.id, user=user, db=db)
        assert out.status == "pending"
    finally:
        await _cleanup(db, user_id)


async def test_cannot_see_someone_elses_payment(db):
    owner = await _user(db)
    other = await _user(db)
    owner_id, other_id = owner.id, other.id
    try:
        payment = await _pending_payment(db, owner_id)
        with pytest.raises(Exception) as info:
            await billing.payment_status(payment.id, user=other, db=db)
        assert getattr(info.value, "status_code", None) == 404
    finally:
        await _cleanup(db, owner_id)
        await _cleanup(db, other_id)


async def test_limit_error_pauses_checks_and_never_expires(db, monkeypatch):
    """Over Bakong's daily allowance the answer is unknown, not "unpaid": the
    payment must stay pending even past its expiry, and we stop asking."""
    user = await _user(db, balance=0)
    user_id = user.id
    calls = 0

    async def limited(_md5):
        nonlocal calls
        calls += 1
        raise bakong.BakongLimitError("Daily request limit of 100 exceeded.")

    try:
        payment = await _pending_payment(db, user_id, expired=True)
        monkeypatch.setattr(bakong, "check_transaction", limited)
        first = await billing.payment_status(payment.id, user=user, db=db)
        second = await billing.payment_status(payment.id, user=user, db=db, force=True)
        assert first.status == second.status == "pending"
        assert first.check_delayed and second.check_delayed
        assert calls == 1  # paused after the first limit answer
    finally:
        await _cleanup(db, user_id)


async def test_polls_are_throttled(db, monkeypatch):
    user = await _user(db, balance=0)
    user_id = user.id
    calls = 0

    async def unpaid(_md5):
        nonlocal calls
        calls += 1
        return None

    try:
        payment = await _pending_payment(db, user_id)
        monkeypatch.setattr(bakong, "check_transaction", unpaid)
        for _ in range(5):  # a browser polling every few seconds
            await billing.payment_status(payment.id, user=user, db=db)
        assert calls == 1
    finally:
        await _cleanup(db, user_id)


async def test_opening_billing_credits_a_payment_made_while_paused(db, monkeypatch):
    user = await _user(db, balance=0)
    user_id = user.id
    try:
        payment = await _pending_payment(db, user_id, expired=True)

        async def paid(_md5):
            return _tx(to=settings.bakong_account_id)

        monkeypatch.setattr(bakong, "check_transaction", paid)
        out = await billing.billing(user=user, db=db)
        assert out.credits == 100
        stored = (await db.execute(select(Payment).where(Payment.id == payment.id))).scalar_one()
        assert stored.status == "paid"
    finally:
        await _cleanup(db, user_id)
