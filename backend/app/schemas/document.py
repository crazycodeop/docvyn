from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    title: str
    filename: str
    file_size: int
    mime_type: str


class DocumentResponse(DocumentBase):
    id: str
    user_id: str
    file_hash: str
    status: str
    error_message: Optional[str] = None
    page_count: int
    chunk_count: int
    metadata_json: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    items: List[DocumentResponse]
    total: int
    page: int
    size: int
    pages: int


class DocumentRetryResponse(BaseModel):
    id: str
    status: str
    message: str
