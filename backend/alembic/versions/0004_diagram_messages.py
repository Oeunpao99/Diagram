"""diagram messages

The Copilot chat thread attached to each diagram. A brand new table — there
is nothing to backfill, and the frontend has never persisted the chat
before this, so every diagram starts with an empty thread.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "diagram_messages",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "diagram_id",
            sa.UUID(),
            sa.ForeignKey("diagrams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("warnings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_diagram_messages_diagram_created",
        "diagram_messages",
        ["diagram_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_diagram_messages_diagram_created", table_name="diagram_messages")
    op.drop_table("diagram_messages")
