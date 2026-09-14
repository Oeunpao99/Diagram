import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Project(Base, UUIDMixin, TimestampMixin):
    """A folder of related diagrams — one customer, one system, one UAT round."""

    __tablename__ = "projects"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(20), default="#5B4BE0")

    owner: Mapped["User"] = relationship(back_populates="projects")  # noqa: F821
    diagrams: Mapped[list["Diagram"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def diagram_count(self) -> int:
        return len(self.diagrams)


class Diagram(Base, UUIDMixin, TimestampMixin):
    """The live document. `data` holds the canonical diagram JSON."""

    __tablename__ = "diagrams"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    diagram_type: Mapped[str] = mapped_column(String(50), default="process_flow")
    direction: Mapped[str] = mapped_column(String(10), default="LR")
    source_prompt: Mapped[str | None] = mapped_column(Text)
    improved_prompt: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    current_version: Mapped[int] = mapped_column(Integer, default=1)

    owner: Mapped["User"] = relationship(back_populates="diagrams")  # noqa: F821
    project: Mapped["Project | None"] = relationship(back_populates="diagrams")
    versions: Mapped[list["DiagramVersion"]] = relationship(
        back_populates="diagram",
        cascade="all, delete-orphan",
        order_by="DiagramVersion.version.desc()",
    )


class DiagramVersion(Base, UUIDMixin, TimestampMixin):
    """Immutable snapshot. Written on every AI edit and on manual save."""

    __tablename__ = "diagram_versions"
    __table_args__ = (
        Index("ix_diagram_versions_diagram_version", "diagram_id", "version", unique=True),
    )

    diagram_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diagrams.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(String(200))
    origin: Mapped[str] = mapped_column(String(30), default="manual")  # manual | ai_edit | generate
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    diagram: Mapped["Diagram"] = relationship(back_populates="versions")


class Template(Base, UUIDMixin, TimestampMixin):
    """Starting points. Seeded built-ins plus anything a user saves."""

    __tablename__ = "templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(50), index=True)  # business | it | data | ...
    diagram_type: Mapped[str] = mapped_column(String(50), default="process_flow")
    description: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list[str]] = mapped_column(JSONB, default=list)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=True)
    use_count: Mapped[int] = mapped_column(Integer, default=0)


class AIRun(Base, UUIDMixin, TimestampMixin):
    """Audit trail for every model call — cost, latency, what it produced."""

    __tablename__ = "ai_runs"

    diagram_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diagrams.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(String(40))  # improve | generate | edit | validate | docs
    model: Mapped[str] = mapped_column(String(80))
    prompt: Mapped[str | None] = mapped_column(Text)
    response_summary: Mapped[str | None] = mapped_column(Text)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(Text)
