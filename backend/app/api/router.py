from fastapi import APIRouter

from app.api.routes import ai, auth, billing, diagrams

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(ai.router)
api_router.include_router(diagrams.router)
api_router.include_router(billing.router)
