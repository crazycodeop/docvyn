from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.db.base import Base
import app.models  # Ensure all SQLAlchemy models are registered
from app.db.session import async_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode...")
    # Create tables if not present (especially for development & SQLite fallback)
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schemas verified.")

    # Re-dispatch or cleanly fail any stalled document ingestions from previous restarts
    try:
        from app.services.document_service import doc_service
        from app.db.session import AsyncSessionLocal
        from app.models.document import Document
        from app.models.user import User
        from app.core.security import get_password_hash, verify_password
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            # Seed demo user if missing or ensure demo password is valid
            demo_stmt = select(User).where(User.email == "demo@cortex.ai")
            demo_user = (await session.execute(demo_stmt)).scalar_one_or_none()
            if not demo_user:
                demo_user = User(
                    email="demo@cortex.ai",
                    hashed_password=get_password_hash("demo123456"),
                    full_name="Demo User",
                    role="user",
                    is_active=True,
                    auth_provider="local",
                )
                session.add(demo_user)
                await session.commit()
                logger.info("Demo user demo@cortex.ai initialized successfully.")
            elif not verify_password("demo123456", demo_user.hashed_password or ""):
                demo_user.hashed_password = get_password_hash("demo123456")
                await session.commit()
                logger.info("Demo user demo@cortex.ai password synced.")

            stalled_stmt = select(Document).where(Document.status.in_(["uploaded", "queued", "processing"]))
            stalled_docs = (await session.execute(stalled_stmt)).scalars().all()
            re_dispatched = 0
            for doc in stalled_docs:
                if doc_service.storage.exists(doc.file_path):
                    doc.status = "queued"
                    await session.commit()
                    doc_service.dispatch_processing_task(doc.id)
                    re_dispatched += 1
                else:
                    doc.status = "failed"
                    doc.error_message = "Interrupted by container restart. Please delete and re-upload."
                    current_meta = dict(doc.metadata_json or {})
                    current_meta.update({"progress": 0, "stage": "failed"})
                    doc.metadata_json = current_meta
                    await session.commit()
            if stalled_docs:
                logger.info(f"Handled {len(stalled_docs)} stalled documents ({re_dispatched} re-dispatched, {len(stalled_docs) - re_dispatched} marked failed).")
    except Exception as e:
        logger.warning(f"Startup task re-dispatch warning: {e}")

    yield
    logger.info("Shutting down application...")
    await async_engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-Grade Document Intelligence Platform with Grounded Citations and RAG.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": "1.0.0",
    }


def get_current_memory_mb() -> float:
    try:
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024, 2)
    except Exception:
        pass
    import resource
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 2)


@app.get("/health", tags=["Health"])
def health():
    mem_mb = get_current_memory_mb()
    return {
        "status": "ok",
        "service": "docvyn",
        "memory_used_mb": mem_mb,
        "memory_limit_mb": 512,
        "memory_percent": round((mem_mb / 512) * 100, 1),
        "environment": settings.ENVIRONMENT,
    }
