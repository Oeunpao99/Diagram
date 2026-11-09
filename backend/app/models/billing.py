import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Payment(Base, UUIDMixin, TimestampMixin):
    """One KHQR checkout: the QR we showed, and whether Bakong says it was paid.

    `md5` is Bakong's handle on the transaction — the md5 of the exact QR
    string — and is what /check_transaction_by_md5 is asked about. Credits are
    added in the same statement that flips status pending -> paid (see
    services/credits.settle_payment), so a payment can only ever credit once
    no matter how many browser tabs poll it.
    """

    __tablename__ = "payments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    pack: Mapped[str] = mapped_column(String(20), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    # Stored in cents so no float ever touches money.
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    qr: Mapped[str] = mapped_column(Text, nullable=False)
    md5: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    # pending -> paid | expired
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Bakong's own transaction hash and payer, kept for reconciliation.
    bakong_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payer_account: Mapped[str | None] = mapped_column(String(128), nullable=True)


__all__ = ["Payment"]
