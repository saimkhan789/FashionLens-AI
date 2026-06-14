from pydantic import BaseModel
from typing import List


class FavoriteRequest(BaseModel):
    product_id: int


class FavoriteItem(BaseModel):
    product_id: int
    display_name: str
    article_type: str
    base_colour: str
    gender: str
    image_path: str


class FavoritesResponse(BaseModel):
    favorites: List[FavoriteItem]
    total: int