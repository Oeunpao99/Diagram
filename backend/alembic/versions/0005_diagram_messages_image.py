"""diagram_messages.image

An optional attached-sketch data URL on a Copilot chat line, so a user's own
message bubble can show the image they sent to describe a diagram — and a
restored thread renders it the same way it did live. Existing rows are all
text-only (the field was never sent before), so there is nothing to backfill.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("diagram_messages", sa.Column("image", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("diagram_messages", "image")
