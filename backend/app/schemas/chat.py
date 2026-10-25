from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class Citation(BaseModel):
    document_id: str
    document_title: str
    page_number: Optional[int] = None
    snippet: str
    score: Optional[float] = None


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="The user query or prompt")
    conversation_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(default=0.35, ge=0.0, le=1.0)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    citations_json: List[Citation] = []
    tokens_used: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation]
    conversation_id: str
    message_id: str
    user_message_id: Optional[str] = None


class EditMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, description="The updated user message content")
    document_ids: Optional[List[str]] = None
    top_k: Optional[int] = Field(default=5, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(default=0.35, ge=0.0, le=1.0)


class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    is_pinned: bool = False
    is_archived: bool = False

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []
    is_pinned: bool = False
    is_archived: bool = False

    model_config = ConfigDict(from_attributes=True)
