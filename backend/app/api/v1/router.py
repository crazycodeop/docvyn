from fastapi import APIRouter
from app.api.v1.endpoints import auth, documents, chat, stats, health, share

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat & RAG"])
api_router.include_router(share.router, tags=["Sharing"])
api_router.include_router(stats.router, prefix="/stats", tags=["Dashboard & Stats"])
api_router.include_router(health.router, tags=["Health"])
