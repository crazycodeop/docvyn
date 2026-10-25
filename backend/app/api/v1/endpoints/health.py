from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.config import settings
from app.db.session import get_async_db

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_async_db)):
    """Health and readiness check verifying database and cache connectivity."""
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    redis_status = "unknown"
    try:
        r = aioredis.from_url(settings.REDIS_URL, socket_timeout=2.0)
        await r.ping()
        await r.close()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"offline: {str(e)}"

    overall = "healthy" if db_status == "healthy" else "degraded"

    return {
        "status": overall,
        "database": db_status,
        "redis": redis_status,
        "version": "1.0.0",
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
    }
