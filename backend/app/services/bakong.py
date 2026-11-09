"""Asking Bakong (NBC's open API) whether a KHQR was paid.

Bakong's open API is rate-limited per token — 100 requests a day on a
standard developer token — so callers must ask sparingly (see the throttle
in api/routes/billing.py) and must never mistake an error answer for "not
paid": over the limit, Bakong still answers HTTP 200 with responseCode 1, the
same code it uses for "transaction not found".
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass(frozen=True)
class Transaction:
    hash: str | None
    from_account: str | None
    to_account: str | None
    currency: str | None
    amount: float | None


class BakongError(RuntimeError):
    """Bakong couldn't answer the question (network, token, outage) —
    distinct from a definite "not paid yet", which is `None`."""


class BakongLimitError(BakongError):
    """The token's daily request allowance is used up."""


async def check_transaction(md5: str) -> Transaction | None:
    """The completed transaction for this QR's md5, or None if Bakong says
    definitively that there isn't one (yet). Anything else raises."""
    if not settings.bakong_api_token:
        raise BakongError("Bakong API token is not configured.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{settings.bakong_api_url.rstrip('/')}/check_transaction_by_md5",
                json={"md5": md5},
                headers={"Authorization": f"Bearer {settings.bakong_api_token}"},
            )
    except httpx.HTTPError as exc:
        raise BakongError(f"Could not reach Bakong: {exc}") from exc

    if response.status_code == 429:
        raise BakongLimitError("Bakong rate limit reached.")
    if response.status_code in (401, 403):
        raise BakongError("Bakong rejected the API token (expired or invalid).")
    if response.status_code >= 400:
        raise BakongError(f"Bakong answered HTTP {response.status_code}.")

    try:
        body = response.json()
    except ValueError as exc:
        raise BakongError("Bakong sent a reply that isn't JSON.") from exc

    data = body.get("data")
    if body.get("responseCode") == 0 and isinstance(data, dict):
        amount = data.get("amount")
        return Transaction(
            hash=data.get("hash"),
            from_account=data.get("fromAccountId"),
            to_account=data.get("toAccountId"),
            currency=data.get("currency"),
            amount=float(amount) if amount is not None else None,
        )

    message = str(body.get("responseMessage") or "")
    lowered = message.lower()
    if "not be found" in lowered or "not found" in lowered:
        return None
    if "limit" in lowered:
        raise BakongLimitError(message)
    raise BakongError(message or f"Unexpected Bakong reply: {body!r}")
