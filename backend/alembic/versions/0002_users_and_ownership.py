"""users, and per-user ownership of projects and diagrams

Existing rows predate accounts, so they are backfilled onto a locked
placeholder user rather than dropped. That account has an unusable password
hash and is_active=False, so nobody can sign into it; reassign or delete the
rows it holds at your leisure.

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY_EMAIL = "legacy-import@localhost"


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("theme", sa.String(length=10), nullable=False, server_default="system"),
        sa.Column("accent", sa.String(length=20), nullable=False, server_default="emerald"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Add nullable first so existing rows survive, then backfill, then lock down.
    op.add_column("projects", sa.Column("owner_id", sa.UUID(), nullable=True))
    op.add_column("diagrams", sa.Column("owner_id", sa.UUID(), nullable=True))

    conn = op.get_bind()
    orphans = conn.execute(
        sa.text("SELECT (SELECT count(*) FROM projects) + (SELECT count(*) FROM diagrams)")
    ).scalar_one()

    if orphans:
        legacy_id = conn.execute(
            sa.text(
                """
                INSERT INTO users (id, email, name, password_hash, is_active)
                VALUES (gen_random_uuid(), :email, 'Legacy import', '!', false)
                RETURNING id
                """
            ),
            {"email": LEGACY_EMAIL},
        ).scalar_one()
        conn.execute(
            sa.text("UPDATE projects SET owner_id = :oid WHERE owner_id IS NULL"),
            {"oid": legacy_id},
        )
        conn.execute(
            sa.text("UPDATE diagrams SET owner_id = :oid WHERE owner_id IS NULL"),
            {"oid": legacy_id},
        )

    op.alter_column("projects", "owner_id", nullable=False)
    op.alter_column("diagrams", "owner_id", nullable=False)

    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    op.create_index("ix_diagrams_owner_id", "diagrams", ["owner_id"])
    op.create_foreign_key(
        "fk_projects_owner_id_users", "projects", "users", ["owner_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_diagrams_owner_id_users", "diagrams", "users", ["owner_id"], ["id"], ondelete="CASCADE"
    )


def downgrade() -> None:
    op.drop_constraint("fk_diagrams_owner_id_users", "diagrams", type_="foreignkey")
    op.drop_constraint("fk_projects_owner_id_users", "projects", type_="foreignkey")
    op.drop_index("ix_diagrams_owner_id", table_name="diagrams")
    op.drop_index("ix_projects_owner_id", table_name="projects")
    op.drop_column("diagrams", "owner_id")
    op.drop_column("projects", "owner_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
