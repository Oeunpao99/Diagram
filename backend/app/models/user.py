from sqlalchemy import Boolean, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
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

    # Nullable: a provider sign-in may never supply an email at all.
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Nullable: an account created via Google/GitHub has no password until
    # (if ever) the user sets one — see the guard in auth.py's login().
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # --- identity provider --------------------------------------------------
    oauth_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    oauth_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # --- credits ------------------------------------------------------------
    # Spent by AI actions, topped up by KHQR payments. Only ever changed by a
    # single conditional UPDATE in services/credits.py, never read-modify-write,
    # so two requests at once can't both spend the last credit.
    credits: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        # New sign-ups (password or Google/GitHub) get the configured amount;
        # the server default only covers rows that existed before this column.
        default=lambda: settings.signup_credits,
        server_default=text("20"),
    )

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
