from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.chat import Citation


class ShareCreateRequest(BaseModel):
    title: Optional[str] = None
    message_ids: Optional[List[str]] = None


class ShareResponse(BaseModel):
    share_token: str
    share_url: str
    title: str
    is_revoked: bool
    created_at: datetime
    message_count: int = 0


class SharedMessageItem(BaseModel):
    id: str
    role: str
    content: str
    citations: List[Citation] = []
    created_at: datetime


class SharedConversationView(BaseModel):
    title: str
    created_at: datetime
    messages: List[SharedMessageItem] = []
