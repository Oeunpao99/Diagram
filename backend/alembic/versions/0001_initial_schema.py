"""initial schema: projects, diagrams, versions, templates, ai runs

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("color", sa.String(20), server_default="#5B4BE0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )

    op.create_table(
        "diagrams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("diagram_type", sa.String(50), server_default="process_flow"),
        sa.Column("direction", sa.String(10), server_default="LR"),
        sa.Column("source_prompt", sa.Text()),
        sa.Column("improved_prompt", sa.Text()),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), server_default="[]"),
        sa.Column("is_favorite", sa.Boolean(), server_default=sa.false()),
        sa.Column("current_version", sa.Integer(), server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_diagrams_project_id", "diagrams", ["project_id"])

    op.create_table(
        "diagram_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "diagram_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diagrams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(200)),
        sa.Column("origin", sa.String(30), server_default="manual"),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_diagram_versions_diagram_version",
        "diagram_versions",
        ["diagram_id", "version"],
        unique=True,
    )

    op.create_table(
        "templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True),
        sa.Column("category", sa.String(50)),
        sa.Column("diagram_type", sa.String(50), server_default="process_flow"),
        sa.Column("description", sa.Text()),
        sa.Column("keywords", postgresql.JSONB(astext_type=sa.Text()), server_default="[]"),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("is_builtin", sa.Boolean(), server_default=sa.true()),
        sa.Column("use_count", sa.Integer(), server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_templates_category", "templates", ["category"])

    op.create_table(
        "ai_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "diagram_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diagrams.id", ondelete="SET NULL"),
        ),
        sa.Column("kind", sa.String(40)),
        sa.Column("model", sa.String(80)),
        sa.Column("prompt", sa.Text()),
        sa.Column("response_summary", sa.Text()),
        sa.Column("input_tokens", sa.Integer(), server_default="0"),
        sa.Column("output_tokens", sa.Integer(), server_default="0"),
        sa.Column("latency_ms", sa.Integer(), server_default="0"),
        sa.Column("ok", sa.Boolean(), server_default=sa.true()),
        sa.Column("error", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_ai_runs_diagram_id", "ai_runs", ["diagram_id"])


def downgrade() -> None:
    op.drop_table("ai_runs")
    op.drop_table("templates")
    op.drop_table("diagram_versions")
    op.drop_table("diagrams")
    op.drop_table("projects")
