import uuid
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimeStampedModel

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(Base, TimeStampedModel):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # "user", "assistant", "system"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # List of citation objects:
    # [{"document_id": "...", "document_title": "...", "page_number": 1, "snippet": "...", "score": 0.88}]
    citations_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationship
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
