"""Asking Bakong (NBC's open API) whether a KHQR was paid."""

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
    """Bakong itself couldn't be asked (network, auth, rate limit) — distinct
    from a clean "not paid yet", which is just `None`."""


async def check_transaction(md5: str) -> Transaction | None:
    """The completed transaction for this QR's md5, or None if it isn't paid
    (yet). Bakong answers responseCode 0 + data for a completed payment and
    responseCode 1 ("could not be found") for anything else."""
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

    if response.status_code in (401, 403):
        raise BakongError("Bakong rejected the API token (expired or invalid).")
    if response.status_code >= 400:
        raise BakongError(f"Bakong answered HTTP {response.status_code}.")

    try:
        body = response.json()
    except ValueError as exc:
        raise BakongError("Bakong sent a reply that isn't JSON.") from exc

    data = body.get("data")
    if body.get("responseCode") != 0 or not isinstance(data, dict):
        return None
    amount = data.get("amount")
    return Transaction(
        hash=data.get("hash"),
        from_account=data.get("fromAccountId"),
        to_account=data.get("toAccountId"),
        currency=data.get("currency"),
        amount=float(amount) if amount is not None else None,
    )
