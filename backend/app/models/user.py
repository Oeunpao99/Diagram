from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    """An account. Also carries the UI preferences shown on the settings page."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # --- preferences ------------------------------------------------------
    # "system" follows the OS; the other two pin it.
    theme: Mapped[str] = mapped_column(String(10), default="system", nullable=False)
    accent: Mapped[str] = mapped_column(String(20), default="emerald", nullable=False)

    projects: Mapped[list["Project"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
    diagrams: Mapped[list["Diagram"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )


__all__ = ["User"]
