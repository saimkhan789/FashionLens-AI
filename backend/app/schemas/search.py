from pydantic import BaseModel
from typing import List
from typing import List, Optional

class SearchResult(BaseModel):
    product_id: str
    score: float
    display_name: str
    article_type: str
    base_colour: str
    gender: str
    master_category: str
    sub_category: str
    image_path: str
    source: Optional[str] = ""
    brand: Optional[str] = ""
    price: Optional[str] = ""
    product_url: Optional[str] = ""
    image_url: Optional[str] = ""


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int