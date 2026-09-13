from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

DEV_JWT_SECRET = "dev-only-insecure-change-me-0000000000000000"

if settings.app_env != "local" and settings.jwt_secret == DEV_JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is still the development default. Set a real one before "
        f"running with APP_ENV={settings.app_env!r}."
    )

app = FastAPI(
    title="Diagram Copilot API",
    version="0.1.0",
    description="Prompt in, structured diagram out — then keep editing it by talking to it.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}
