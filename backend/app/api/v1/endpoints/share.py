import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_async_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.share import ConversationShare
from app.models.user import User
from app.schemas.chat import Citation
from app.schemas.share import (
    ShareCreateRequest,
    ShareResponse,
    SharedConversationView,
    SharedMessageItem,
)

router = APIRouter()


@router.post("/chat/conversations/{conversation_id}/share", response_model=ShareResponse)
async def create_or_update_share(
    conversation_id: str,
    req: ShareCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Creates a secure, read-only share link or updates an existing share for the conversation."""
    stmt = select(Conversation).where(
        and_(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    # Check if an active share already exists
    share_stmt = select(ConversationShare).where(
        and_(ConversationShare.conversation_id == conv.id, ConversationShare.is_revoked == False)
    )
    existing_share = (await db.execute(share_stmt)).scalar_one_or_none()

    if existing_share:
        # Update existing share
        if req.title:
            existing_share.title = req.title.strip()
        if req.message_ids is not None:
            existing_share.shared_message_ids = req.message_ids
        await db.commit()
        await db.refresh(existing_share)
        share = existing_share
    else:
        # Create fresh unguessable token
        token = secrets.token_urlsafe(32)
        share = ConversationShare(
            conversation_id=conv.id,
            user_id=current_user.id,
            share_token=token,
            title=req.title.strip() if req.title else conv.title,
            shared_message_ids=req.message_ids or [],
            is_revoked=False,
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

    # Count shared messages
    msg_stmt = select(Message).where(Message.conversation_id == conv.id)
    all_msgs = list((await db.execute(msg_stmt)).scalars().all())
    count = len(share.shared_message_ids) if share.shared_message_ids else len(all_msgs)

    return ShareResponse(
        share_token=share.share_token,
        share_url=f"/share/{share.share_token}",
        title=share.title,
        is_revoked=share.is_revoked,
        created_at=share.created_at,
        message_count=count,
    )


@router.get("/chat/conversations/{conversation_id}/share", response_model=Optional[ShareResponse])
async def get_conversation_share(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Fetches active share status for a conversation (creator only)."""
    stmt = select(ConversationShare).where(
        and_(
            ConversationShare.conversation_id == conversation_id,
            ConversationShare.user_id == current_user.id,
            ConversationShare.is_revoked == False,
        )
    )
    share = (await db.execute(stmt)).scalar_one_or_none()
    if not share:
        return None

    return ShareResponse(
        share_token=share.share_token,
        share_url=f"/share/{share.share_token}",
        title=share.title,
        is_revoked=share.is_revoked,
        created_at=share.created_at,
        message_count=len(share.shared_message_ids) if share.shared_message_ids else 0,
    )


@router.delete("/chat/conversations/{conversation_id}/share")
async def revoke_conversation_share(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Revokes the active share link for a conversation so it can no longer be viewed."""
    stmt = select(ConversationShare).where(
        and_(
            ConversationShare.conversation_id == conversation_id,
            ConversationShare.user_id == current_user.id,
            ConversationShare.is_revoked == False,
        )
    )
    share = (await db.execute(stmt)).scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active share link found.")

    share.is_revoked = True
    await db.commit()
    return {"message": "Share link revoked successfully."}


@router.get("/shared/{share_token}", response_model=SharedConversationView)
async def get_shared_conversation(
    share_token: str,
    db: AsyncSession = Depends(get_async_db),
):
    """Public, read-only endpoint returning sanitized conversation and citations.
    Rejects revoked or invalid tokens. Does NOT expose user identity or file downloads.
    """
    stmt = select(ConversationShare).where(
        and_(ConversationShare.share_token == share_token, ConversationShare.is_revoked == False)
    )
    share = (await db.execute(stmt)).scalar_one_or_none()
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared conversation not found or access has been revoked.",
        )

    # Fetch messages
    msg_stmt = (
        select(Message)
        .where(Message.conversation_id == share.conversation_id)
        .order_by(Message.created_at.asc())
    )
    all_msgs = list((await db.execute(msg_stmt)).scalars().all())

    # Filter to permitted messages if partial share
    selected_ids = set(share.shared_message_ids or [])
    visible_msgs = [m for m in all_msgs if not selected_ids or m.id in selected_ids]

    shared_items = []
    for m in visible_msgs:
        # Sanitize citations (keep title, page, snippet, but omit internal IDs and file paths)
        raw_cits = m.citations_json or []
        sanitized_cits = [
            Citation(
                document_id="ref",
                document_title=c.get("document_title", "Document Reference"),
                page_number=c.get("page_number"),
                snippet=c.get("snippet", ""),
                score=c.get("score"),
            )
            for c in raw_cits
        ]

        shared_items.append(
            SharedMessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                citations=sanitized_cits,
                created_at=m.created_at,
            )
        )

    return SharedConversationView(
        title=share.title,
        created_at=share.created_at,
        messages=shared_items,
    )
