"""Reading Bakong's replies: only an explicit "not found" means unpaid."""

import httpx
import pytest

from app.core.config import settings
from app.services import bakong


@pytest.fixture
def reply(monkeypatch):
    monkeypatch.setattr(settings, "bakong_api_token", "test-token")

    def install(status: int, body: dict):
        transport = httpx.MockTransport(lambda request: httpx.Response(status, json=body))
        real = httpx.AsyncClient
        monkeypatch.setattr(
            bakong.httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw)
        )

    return install


async def test_paid(reply):
    reply(
        200,
        {
            "responseCode": 0,
            "data": {
                "hash": "abc",
                "fromAccountId": "payer@abaa",
                "toAccountId": "kumnous@aclb",
                "currency": "USD",
                "amount": 3,
            },
        },
    )
    tx = await bakong.check_transaction("0" * 32)
    assert tx is not None and tx.amount == 3.0 and tx.from_account == "payer@abaa"


async def test_not_found_is_unpaid(reply):
    reply(
        200,
        {
            "responseCode": 1,
            "responseMessage": "Transaction could not be found. Please check and try again.",
            "errorCode": 1,
            "data": None,
        },
    )
    assert await bakong.check_transaction("0" * 32) is None


async def test_daily_limit_is_an_error_not_unpaid(reply):
    reply(
        200,
        {
            "responseCode": 1,
            "responseMessage": "Daily request limit of 100 exceeded. Please try again tomorrow.",
            "data": None,
        },
    )
    with pytest.raises(bakong.BakongLimitError):
        await bakong.check_transaction("0" * 32)


async def test_unknown_failure_is_an_error(reply):
    reply(200, {"responseCode": 1, "responseMessage": "Something else", "data": None})
    with pytest.raises(bakong.BakongError):
        await bakong.check_transaction("0" * 32)
