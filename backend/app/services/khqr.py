"""KHQR (Bakong / EMVCo merchant-presented QR) encoding.

A KHQR is a string of TLV fields — two-digit tag, two-digit length, value —
ending in a CRC-16 checksum, which any Cambodian banking app (ABA, ACLEDA,
Wing, Bakong, ...) can scan and pay. Field order and limits follow NBC's KHQR
spec, the same layout the official SDK and the `bakong-khqr` package produce:

  00 payload format "01"      01 initiation: "12" dynamic (has an amount)
  29 individual account       52 merchant category "5999"
  53 currency (840 USD/116 KHR) 54 amount
  58 country "KH"             59 merchant name   60 merchant city
  62 additional data (bill no., store label, terminal)
  99 timestamps (created, expires)      63 CRC

Bakong identifies a transaction by the md5 of the full QR string, which is
what services/bakong.check_transaction asks about.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass

_CURRENCY = {"USD": "840", "KHR": "116"}


def _tlv(tag: str, value: str) -> str:
    if len(value) > 99:
        raise ValueError(f"KHQR field {tag} is too long ({len(value)} > 99).")
    return f"{tag}{len(value):02d}{value}"


def crc16(data: str) -> str:
    """CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as 4 uppercase hex digits."""
    crc = 0xFFFF
    for byte in data.encode("utf-8"):
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
            crc &= 0xFFFF
    return f"{crc:04X}"


def format_amount(amount_cents: int) -> str:
    """300 -> "3", 350 -> "3.5", 1 -> "0.01" — no trailing zeros, as KHQR wants."""
    whole, cents = divmod(amount_cents, 100)
    return str(whole) if cents == 0 else f"{whole}.{cents:02d}".rstrip("0")


@dataclass(frozen=True)
class Merchant:
    account_id: str  # Bakong account id, e.g. "name@aclb"
    name: str  # shown in the payer's app, max 25 chars
    city: str = "Phnom Penh"  # max 15 chars
    account_info: str | None = None  # optional, max 32
    acquiring_bank: str | None = None  # optional, max 32


def build(
    merchant: Merchant,
    *,
    amount_cents: int,
    currency: str = "USD",
    bill_number: str | None = None,
    store_label: str | None = None,
    terminal_label: str | None = None,
    expires_in_seconds: int = 15 * 60,
    now_ms: int | None = None,
) -> str:
    """A dynamic (fixed-amount, expiring) KHQR string ready to render as a QR."""
    if amount_cents <= 0:
        raise ValueError("Amount must be positive.")
    if currency not in _CURRENCY:
        raise ValueError(f"Unsupported currency {currency!r}.")
    if len(merchant.account_id) > 32:
        raise ValueError("Bakong account id is longer than 32 characters.")
    if not merchant.name or len(merchant.name) > 25:
        raise ValueError("Merchant name must be 1-25 characters.")
    if not merchant.city or len(merchant.city) > 15:
        raise ValueError("Merchant city must be 1-15 characters.")

    account = _tlv("00", merchant.account_id)
    if merchant.account_info:
        account += _tlv("01", merchant.account_info[:32])
    if merchant.acquiring_bank:
        account += _tlv("02", merchant.acquiring_bank[:32])

    extra = ""
    if bill_number:
        extra += _tlv("01", bill_number[:25])
    if store_label:
        extra += _tlv("03", store_label[:25])
    if terminal_label:
        extra += _tlv("07", terminal_label[:25])

    created = now_ms if now_ms is not None else int(time.time() * 1000)
    expires = created + expires_in_seconds * 1000

    payload = (
        _tlv("00", "01")
        + _tlv("01", "12")
        + _tlv("29", account)
        + _tlv("52", "5999")
        + _tlv("53", _CURRENCY[currency])
        + _tlv("54", format_amount(amount_cents))
        + _tlv("58", "KH")
        + _tlv("59", merchant.name)
        + _tlv("60", merchant.city)
        + (_tlv("62", extra) if extra else "")
        + _tlv("99", _tlv("00", str(created)) + _tlv("01", str(expires)))
    )
    return payload + "6304" + crc16(payload + "6304")


def md5(qr: str) -> str:
    return hashlib.md5(qr.encode("utf-8")).hexdigest()


def parse(qr: str) -> dict[str, str]:
    """Top-level tag -> value. For tests and debugging, not for trusting input."""
    fields: dict[str, str] = {}
    i = 0
    while i < len(qr):
        tag, length = qr[i : i + 2], int(qr[i + 2 : i + 4])
        fields[tag] = qr[i + 4 : i + 4 + length]
        i += 4 + length
    return fields
