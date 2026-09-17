from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    database_url: str = "postgresql+asyncpg://diagram:diagram@localhost:5432/diagram"

    # --- Azure OpenAI -----------------------------------------------------
    # The endpoint is the v1 surface ("https://<res>.services.ai.azure.com/openai/v1/"),
    # which speaks plain OpenAI, so the stock AsyncOpenAI client works against it
    # and `model` is the *deployment* name rather than a catalogue model id.
    azure_openai_api_key: str | None = None
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-5-mini"
    azure_openai_vision_deployment: str = "gpt-5-mini"
    # Cheap/quick calls (prompt polishing, narration). Falls back to the main one.
    azure_openai_fast_deployment: str | None = None
    # gpt-5 family only. Set to None if you point this at a non-reasoning deployment.
    azure_openai_reasoning_effort: str | None = "low"

    # --- Auth -------------------------------------------------------------
    # Must be overridden in any non-local environment; main.py refuses to boot
    # with the default when APP_ENV != "local".
    jwt_secret: str = "dev-only-insecure-change-me-0000000000000000"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # a week; it's an internal tool

    cors_origins: str = "http://localhost:5173"

    # --- Social sign-in -----------------------------------------------------
    # All optional: an unset provider's /auth/{provider} route answers 501
    # rather than the app refusing to boot, so partial setup is fine.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    github_client_id: str | None = None
    github_client_secret: str | None = None
    # sha256(this) is the HMAC key Telegram signs widget payloads with — never
    # sent to the frontend, unlike the client ids above.
    telegram_bot_token: str | None = None

    @property
    def fast_deployment(self) -> str:
        return self.azure_openai_fast_deployment or self.azure_openai_deployment

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sync_database_url(self) -> str:
        """Alembic can run async, but a sync URL is handy for tooling/psql."""
        return self.database_url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
