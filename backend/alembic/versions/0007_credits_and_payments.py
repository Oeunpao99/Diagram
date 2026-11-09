"""credits and KHQR payments

Adds a credit balance to every account and a table of KHQR checkouts.
Existing accounts start with the same 20 credits a new sign-up gets.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("credits", sa.Integer(), nullable=False, server_default=sa.text("20")),
    )
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pack", sa.String(length=20), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("qr", sa.Text(), nullable=False),
        sa.Column("md5", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bakong_hash", sa.String(length=128), nullable=True),
        sa.Column("payer_account", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_md5", "payments", ["md5"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_payments_md5", table_name="payments")
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_table("payments")
    op.drop_column("users", "credits")
