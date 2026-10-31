"""diagram sharing

One shareable link per diagram, carrying one role. `share_token` is a random
urlsafe string (NULL means "not currently shared"); `share_role` is "view" or
"edit" and only means anything alongside a token. No data migration — every
existing row starts unshared.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("diagrams", sa.Column("share_token", sa.String(length=43), nullable=True))
    op.add_column("diagrams", sa.Column("share_role", sa.String(length=10), nullable=True))
    op.create_index(
        "ix_diagrams_share_token", "diagrams", ["share_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_diagrams_share_token", table_name="diagrams")
    op.drop_column("diagrams", "share_role")
    op.drop_column("diagrams", "share_token")
