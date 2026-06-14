from pydantic import BaseModel
from typing import List
from datetime import datetime


class HistoryEntry(BaseModel):
    query: str
    query_type: str
    results: List[dict]
    created_at: datetime


class HistoryResponse(BaseModel):
    history: List[HistoryEntry]
    total: int