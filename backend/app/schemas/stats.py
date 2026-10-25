from typing import Dict, List, Optional
from pydantic import BaseModel


class DailyMetric(BaseModel):
    date: str
    count: int


class RecentDocItem(BaseModel):
    id: str
    filename: str
    title: Optional[str] = None
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    created_at: str


class DashboardStatsResponse(BaseModel):
    total_documents: int
    total_pages: int
    total_chunks: int
    total_conversations: int
    total_messages: int
    storage_used_bytes: int
    status_counts: Dict[str, int]
    daily_ingestion_history: List[DailyMetric] = []
    daily_message_history: List[DailyMetric] = []
    recent_documents: List[RecentDocItem] = []
    file_types_breakdown: Dict[str, int] = {}
