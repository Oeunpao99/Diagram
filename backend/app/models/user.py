from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class User(Base, UUIDMixin, TimestampMixin):
    """An account. Also carries the UI preferences shown on the settings page."""

    __tablename__ = "users"
    __table_args__ = (
        # One provider identity can only ever belong to one local account.
        # Partial (oauth_provider IS NOT NULL) so the many password-only rows
        # with both columns NULL don't collide with each other.
        Index(
            "ix_users_oauth_identity",
            "oauth_provider",
            "oauth_id",
            unique=True,
            postgresql_where="oauth_provider IS NOT NULL",
        ),
    )

    # Nullable: a Telegram sign-in never supplies an email at all.
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Nullable: an account created via Google/GitHub/Telegram has no password
    # until (if ever) the user sets one — see the guard in auth.py's login().
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # --- identity provider --------------------------------------------------
    oauth_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    oauth_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

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
