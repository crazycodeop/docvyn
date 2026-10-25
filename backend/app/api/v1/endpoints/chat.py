import re
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_async_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import (
    ConversationCreate,
    ConversationDetailResponse,
    ConversationResponse,
    ConversationUpdate,
    EditMessageRequest,
    MessageResponse,
    QueryRequest,
    QueryResponse,
)
from app.services.pdf_export_service import PDFExportService
from app.services.rag_service import RAGService

router = APIRouter()
rag_service = RAGService()


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Lists conversations for the user with message counts, sorted by pin status then recency."""
    stmt = (
        select(Conversation, func.count(Message.id).label("msg_count"))
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(
            and_(
                Conversation.user_id == current_user.id,
                Conversation.is_archived == archived,
            )
        )
        .group_by(Conversation.id)
        .order_by(Conversation.is_pinned.desc(), Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    convs = []
    for conv, count in rows:
        conv_dict = {
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": count or 0,
            "is_pinned": bool(conv.is_pinned),
            "is_archived": bool(conv.is_archived),
        }
        convs.append(ConversationResponse(**conv_dict))
    return convs


@router.get("/conversations/search")
async def search_conversations(
    q: str,
    archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Searches conversation titles and message content with context snippets."""
    query_term = q.strip()
    if not query_term:
        return []

    # 1. Search conversations by title
    title_stmt = (
        select(Conversation)
        .where(
            and_(
                Conversation.user_id == current_user.id,
                Conversation.is_archived == archived,
                Conversation.title.ilike(f"%{query_term}%"),
            )
        )
        .order_by(Conversation.updated_at.desc())
        .limit(20)
    )
    title_convs = list((await db.execute(title_stmt)).scalars().all())

    # 2. Search message contents
    msg_stmt = (
        select(Message, Conversation)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            and_(
                Conversation.user_id == current_user.id,
                Conversation.is_archived == archived,
                Message.content.ilike(f"%{query_term}%"),
            )
        )
        .order_by(Message.created_at.desc())
        .limit(30)
    )
    msg_rows = (await db.execute(msg_stmt)).all()

    # Consolidate results by conversation_id to avoid duplicates
    results_map = {}

    for conv in title_convs:
        results_map[conv.id] = {
            "id": conv.id,
            "title": conv.title,
            "is_pinned": bool(conv.is_pinned),
            "is_archived": bool(conv.is_archived),
            "updated_at": conv.updated_at.isoformat() if hasattr(conv.updated_at, "isoformat") else str(conv.updated_at),
            "snippet": f"Matching title: {conv.title}",
            "match_type": "title",
        }

    for msg, conv in msg_rows:
        if conv.id not in results_map:
            # Extract a 120-char snippet around the match
            content = msg.content
            idx = content.lower().find(query_term.lower())
            start = max(0, idx - 40)
            end = min(len(content), idx + len(query_term) + 60)
            snippet = ("..." if start > 0 else "") + content[start:end].strip() + ("..." if end < len(content) else "")
            
            results_map[conv.id] = {
                "id": conv.id,
                "title": conv.title,
                "is_pinned": bool(conv.is_pinned),
                "is_archived": bool(conv.is_archived),
                "updated_at": conv.updated_at.isoformat() if hasattr(conv.updated_at, "isoformat") else str(conv.updated_at),
                "snippet": snippet,
                "match_type": "message",
            }

    return list(results_map.values())


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    req: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Creates a new conversation session."""
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title=req.title or "New Conversation",
        is_pinned=False,
        is_archived=False,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationResponse.model_validate(conv)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Fetches conversation history and all messages."""
    stmt = select(Conversation).where(
        and_(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    # Explicitly query messages
    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )
    messages = list((await db.execute(msg_stmt)).scalars().all())

    return ConversationDetailResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        is_pinned=bool(conv.is_pinned),
        is_archived=bool(conv.is_archived),
        messages=[MessageResponse.model_validate(m) for m in messages],
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    req: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Updates conversation title, pinned status, or archived status."""
    stmt = select(Conversation).where(
        and_(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    if req.title is not None and req.title.strip():
        conv.title = req.title.strip()
    if req.is_pinned is not None:
        conv.is_pinned = req.is_pinned
    if req.is_archived is not None:
        conv.is_archived = req.is_archived
        if req.is_archived:
            conv.is_pinned = False

    await db.commit()
    await db.refresh(conv)
    return ConversationResponse.model_validate(conv)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Deletes conversation and associated messages."""
    stmt = select(Conversation).where(
        and_(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    await db.delete(conv)
    await db.commit()
    return {"message": "Conversation deleted successfully."}


@router.get("/conversations/{conversation_id}/export-pdf")
async def export_conversation_pdf(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Generates a polished, multi-page vector PDF containing the complete conversation history."""
    stmt = select(Conversation).where(
        and_(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    )
    messages = list((await db.execute(msg_stmt)).scalars().all())

    msg_dicts = [
        {
            "role": m.role,
            "content": m.content,
            "citations_json": m.citations_json or [],
            "created_at": m.created_at.isoformat() if hasattr(m.created_at, "isoformat") else str(m.created_at),
        }
        for m in messages
    ]

    pdf_buffer = PDFExportService.export_conversation_to_pdf(
        conversation_title=conv.title,
        messages=msg_dicts,
        user_email=current_user.email,
    )

    safe_title = re.sub(r"[^a-zA-Z0-9_\- ]", "_", conv.title).strip() or "conversation"
    filename = f"{safe_title}.pdf"

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/query", response_model=QueryResponse)
async def query_rag(
    req: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Executes end-to-end RAG query across user's authorized documents."""
    conv_id = req.conversation_id
    conversation = None

    if conv_id:
        stmt = select(Conversation).where(
            and_(Conversation.id == conv_id, Conversation.user_id == current_user.id)
        )
        conversation = (await db.execute(stmt)).scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    else:
        # Auto-create conversation with first 40 chars of question as title
        auto_title = req.question[:40] + ("..." if len(req.question) > 40 else "")
        conversation = Conversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            title=auto_title,
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        conv_id = conversation.id

    # Gather conversation history explicitly
    history = []
    if conv_id:
        prev_msgs_stmt = (
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.asc())
        )
        prev_msgs = list((await db.execute(prev_msgs_stmt)).scalars().all())
        for m in prev_msgs:
            history.append({"role": m.role, "content": m.content})

    # Save user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        role="user",
        content=req.question,
        citations_json=[],
    )
    db.add(user_msg)
    await db.commit()

    # Execute RAG pipeline
    answer, citations = await rag_service.answer_query(
        db=db,
        user_id=current_user.id,
        question=req.question,
        document_ids=req.document_ids,
        conversation_history=history,
        top_k=req.top_k or 5,
        similarity_threshold=req.similarity_threshold or 0.35,
    )

    # Save assistant message with citations
    citations_data = [c.model_dump() for c in citations]
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        role="assistant",
        content=answer,
        citations_json=citations_data,
    )
    db.add(assistant_msg)
    await db.commit()

    return QueryResponse(
        answer=answer,
        citations=citations,
        conversation_id=conv_id,
        message_id=assistant_msg.id,
        user_message_id=user_msg.id,
    )


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/edit",
    response_model=QueryResponse,
)
async def edit_message_and_regenerate(
    conversation_id: str,
    message_id: str,
    req: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """
    Edits a prior user message and regenerates a new assistant response.
    Truncates any subsequent turns from the conversation to maintain a coherent linear history,
    matching modern chat application behavior (e.g., ChatGPT).
    """
    # 1. Verify conversation ownership
    conv_stmt = select(Conversation).where(
        and_(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conv = (await db.execute(conv_stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    if conv.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit messages in an archived conversation.",
        )

    # 2. Verify target user message
    target_stmt = select(Message).where(
        and_(Message.id == message_id, Message.conversation_id == conversation_id)
    )
    target_msg = (await db.execute(target_stmt)).scalar_one_or_none()
    if not target_msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    if target_msg.role != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only user messages can be edited.",
        )

    # 3. Delete all subsequent messages in this conversation (created after target_msg)
    delete_stmt = select(Message).where(
        and_(
            Message.conversation_id == conversation_id,
            Message.created_at > target_msg.created_at,
        )
    )
    subsequent_msgs = list((await db.execute(delete_stmt)).scalars().all())
    for sub_msg in subsequent_msgs:
        await db.delete(sub_msg)

    # 4. Update the target message content
    target_msg.content = req.content
    db.add(target_msg)

    # 5. Gather conversation history prior to target_msg
    history_stmt = (
        select(Message)
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.created_at < target_msg.created_at,
            )
        )
        .order_by(Message.created_at.asc())
    )
    prior_msgs = list((await db.execute(history_stmt)).scalars().all())
    history = [{"role": m.role, "content": m.content} for m in prior_msgs]

    # 6. If this was the first message, update conversation title accordingly
    if len(prior_msgs) == 0:
        conv.title = req.content[:40] + ("..." if len(req.content) > 40 else "")
        db.add(conv)

    await db.commit()

    # 7. Execute RAG pipeline with updated message and prior context
    answer, citations = await rag_service.answer_query(
        db=db,
        user_id=current_user.id,
        question=req.content,
        document_ids=req.document_ids,
        conversation_history=history,
        top_k=req.top_k or 5,
        similarity_threshold=req.similarity_threshold or 0.35,
    )

    # 8. Save new assistant message
    citations_data = [c.model_dump() for c in citations]
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="assistant",
        content=answer,
        citations_json=citations_data,
    )
    db.add(assistant_msg)
    await db.commit()

    return QueryResponse(
        answer=answer,
        citations=citations,
        conversation_id=conversation_id,
        message_id=assistant_msg.id,
        user_message_id=target_msg.id,
    )
