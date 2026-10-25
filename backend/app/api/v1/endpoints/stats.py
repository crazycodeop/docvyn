from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_async_db
from app.models.chunk import DocumentChunk
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.user import User
from app.schemas.stats import (
    DashboardStatsResponse,
    DailyMetric,
    RecentDocItem,
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Calculates real, database-backed metrics for the current user's workspace."""
    # 1. Documents aggregate: total_docs, total_pages, storage_used
    doc_query = select(
        func.count(Document.id).label("total_docs"),
        func.coalesce(func.sum(Document.page_count), 0).label("total_pages"),
        func.coalesce(func.sum(Document.file_size), 0).label("storage_used"),
    ).where(Document.user_id == current_user.id)
    doc_res = (await db.execute(doc_query)).one()

    # 2. Total chunks
    chunk_query = (
        select(func.count(DocumentChunk.id))
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.user_id == current_user.id)
    )
    total_chunks = (await db.execute(chunk_query)).scalar() or 0

    # 3. Total conversations
    conv_query = select(func.count(Conversation.id)).where(Conversation.user_id == current_user.id)
    total_convs = (await db.execute(conv_query)).scalar() or 0

    # 4. Total messages
    msg_query = (
        select(func.count(Message.id))
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.user_id == current_user.id)
    )
    total_msgs = (await db.execute(msg_query)).scalar() or 0

    # 5. Document status breakdown
    status_query = (
        select(Document.status, func.count(Document.id))
        .where(Document.user_id == current_user.id)
        .group_by(Document.status)
    )
    status_rows = (await db.execute(status_query)).all()
    status_counts = {"uploaded": 0, "queued": 0, "processing": 0, "completed": 0, "failed": 0}
    for st, count in status_rows:
        if st in status_counts:
            status_counts[st] = count
        else:
            status_counts[st] = count

    # 6. File types breakdown (e.g., pdf, docx)
    mime_query = (
        select(Document.mime_type, func.count(Document.id))
        .where(Document.user_id == current_user.id)
        .group_by(Document.mime_type)
    )
    mime_rows = (await db.execute(mime_query)).all()
    file_types_breakdown: Dict[str, int] = {}
    for mime, count in mime_rows:
        label = "PDF" if "pdf" in (mime or "").lower() else "DOCX" if "word" in (mime or "").lower() else (mime or "Other")
        file_types_breakdown[label] = file_types_breakdown.get(label, 0) + count

    # 7. Real daily activity history (last 14 days)
    today = datetime.now(timezone.utc).date()
    fourteen_days_ago = datetime.now(timezone.utc) - timedelta(days=14)

    # Ingestion history
    doc_dates_stmt = (
        select(Document.created_at)
        .where(and_(Document.user_id == current_user.id, Document.created_at >= fourteen_days_ago))
    )
    doc_dates = (await db.execute(doc_dates_stmt)).scalars().all()
    doc_counts_by_day = defaultdict(int)
    for dt in doc_dates:
        if dt:
            d_str = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt)[:10]
            doc_counts_by_day[d_str] += 1

    # Message activity history
    msg_dates_stmt = (
        select(Message.created_at)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(and_(Conversation.user_id == current_user.id, Message.created_at >= fourteen_days_ago))
    )
    msg_dates = (await db.execute(msg_dates_stmt)).scalars().all()
    msg_counts_by_day = defaultdict(int)
    for dt in msg_dates:
        if dt:
            d_str = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt)[:10]
            msg_counts_by_day[d_str] += 1

    daily_ingestion_history: List[DailyMetric] = []
    daily_message_history: List[DailyMetric] = []
    for i in range(13, -1, -1):
        d_key = (today - timedelta(days=i)).isoformat()
        daily_ingestion_history.append(DailyMetric(date=d_key, count=doc_counts_by_day[d_key]))
        daily_message_history.append(DailyMetric(date=d_key, count=msg_counts_by_day[d_key]))

    # 8. Recent documents (up to 5)
    recent_docs_stmt = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .limit(5)
    )
    recent_docs_rows = (await db.execute(recent_docs_stmt)).scalars().all()
    recent_documents: List[RecentDocItem] = []
    for d in recent_docs_rows:
        recent_documents.append(
            RecentDocItem(
                id=d.id,
                filename=d.filename,
                title=d.title,
                file_size=d.file_size or 0,
                page_count=d.page_count or 0,
                chunk_count=d.chunk_count or 0,
                status=d.status,
                created_at=d.created_at.isoformat() if hasattr(d.created_at, "isoformat") else str(d.created_at),
            )
        )

    return DashboardStatsResponse(
        total_documents=doc_res.total_docs or 0,
        total_pages=doc_res.total_pages or 0,
        total_chunks=total_chunks,
        total_conversations=total_convs,
        total_messages=total_msgs,
        storage_used_bytes=doc_res.storage_used or 0,
        status_counts=status_counts,
        daily_ingestion_history=daily_ingestion_history,
        daily_message_history=daily_message_history,
        recent_documents=recent_documents,
        file_types_breakdown=file_types_breakdown,
    )
