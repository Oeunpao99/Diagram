from fastapi import APIRouter

from app.api.routes import ai, auth, diagrams

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(ai.router)
api_router.include_router(diagrams.router)
