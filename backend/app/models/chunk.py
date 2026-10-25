import uuid
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimeStampedModel
from app.core.config import settings

try:
    from pgvector.sqlalchemy import Vector
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False

if TYPE_CHECKING:
    from app.models.document import Document


class DocumentChunk(Base, TimeStampedModel):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Vector embedding (768 dimensions for Gemini text-embedding-004)
    # Uses Vector type on PostgreSQL with pgvector, falls back to JSON for non-pgvector environments
    if HAS_PGVECTOR:
        embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(settings.VECTOR_DIMENSION), nullable=True)
    else:
        embedding: Mapped[Optional[List[float]]] = mapped_column(JSON, nullable=True)

    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="chunks")
