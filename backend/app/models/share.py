import uuid
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimeStampedModel

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.conversation import Conversation


class ConversationShare(Base, TimeStampedModel):
    __tablename__ = "conversation_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Optional list of message IDs included in the share. If empty/null, all messages are shared.
    shared_message_ids: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list, nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")
    conversation: Mapped["Conversation"] = relationship("Conversation")
