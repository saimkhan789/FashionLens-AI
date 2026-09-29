import re
from dataclasses import dataclass, field
from decimal import Decimal

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.common import NON_APPAREL
from app.models import Product, Store

# Similarity-sorted candidates we pull before re-sorting by price.
PRICE_SORT_POOL = 200


@dataclass
class Filters:
    store_ids: list[int] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    gender: str | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    sort: str = "relevance"  # relevance | price_asc | price_desc
    # Set per detected item (not user-facing): see detection.category_scope.
    scope: set[str] | None = None
    exclude: set[str] = field(default_factory=set)

    def as_dict(self) -> dict:
        return {
            "store_ids": self.store_ids, "categories": self.categories, "gender": self.gender,
            "min_price": float(self.min_price) if self.min_price else None,
            "max_price": float(self.max_price) if self.max_price else None,
            "sort": self.sort,
        }


def product_out(p: Product, store_name: str, score: float | None = None) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "brand": store_name,
        "store_id": p.store_id,
        "price": float(p.price) if p.price is not None else None,
        "compare_at_price": float(p.compare_at_price) if p.compare_at_price is not None else None,
        "currency": "PKR",
        "image_url": p.image_url,
        "product_url": p.product_url,
        "category": p.category,
        "gender": p.gender,
        "score": round(score, 4) if score is not None else None,
    }


async def vector_search(session: AsyncSession, vec: np.ndarray, f: Filters, offset: int = 0, limit: int = 24,
                        exclude_id: int | None = None) -> tuple[list[dict], bool]:
    distance = Product.embedding.cosine_distance(vec)
    q = (
        select(Product, Store.name, distance.label("distance"))
        .join(Store)
        .where(Product.available, Product.embedding.is_not(None), Store.active)
    )
    if f.store_ids:
        q = q.where(Product.store_id.in_(f.store_ids))
    if f.categories:
        q = q.where(Product.category.in_(f.categories))
    elif f.scope:
        q = q.where(Product.category.in_(f.scope))
    else:
        hidden = NON_APPAREL | f.exclude
        q = q.where(Product.category.is_(None) | Product.category.not_in(hidden))
    if f.gender:
        # Unlabelled products stay in: most brands don't tag gender consistently.
        q = q.where(Product.gender.is_(None) | (Product.gender == f.gender))
    if f.min_price is not None:
        q = q.where(Product.price >= f.min_price)
    if f.max_price is not None:
        q = q.where(Product.price <= f.max_price)
    if exclude_id is not None:
        q = q.where(Product.id != exclude_id)

    # Keep scanning the HNSW index until enough rows pass the filters.
    await session.execute(text("SET LOCAL hnsw.iterative_scan = strict_order"))
    await session.execute(text("SET LOCAL hnsw.ef_search = 200"))

    if f.sort in ("price_asc", "price_desc"):
        rows = (await session.execute(q.order_by(distance).limit(PRICE_SORT_POOL))).all()
        rows = [r for r in rows if r[0].price is not None]
        rows.sort(key=lambda r: r[0].price, reverse=f.sort == "price_desc")
        page = rows[offset:offset + limit]
        has_more = offset + limit < len(rows)
    else:
        rows = (await session.execute(q.order_by(distance).offset(offset).limit(limit + 1))).all()
        page, has_more = rows[:limit], len(rows) > limit
    return [product_out(p, name, 1 - dist) for p, name, dist in page], has_more


_PRICE_MAX = re.compile(r"\b(?:under|below|less than|upto|up to|within|max|<)\s*(?:rs\.?|pkr)?\s*(\d[\d,]*)\s*(k)?\b", re.I)
_PRICE_MIN = re.compile(r"\b(?:over|above|more than|min|>)\s*(?:rs\.?|pkr)?\s*(\d[\d,]*)\s*(k)?\b", re.I)
_GENDER_WORDS = {
    "women": r"\b(women'?s?|ladies|female|girls?)\b",
    "men": r"\b(men'?s?|gents|male|boys?)\b",
}


def _amount(m: re.Match) -> Decimal:
    value = Decimal(m.group(1).replace(",", ""))
    return value * 1000 if m.group(2) else value


def parse_query(q: str, stores: list[tuple[int, str]], f: Filters) -> str:
    """Pulls filters people naturally type ("khaadi kurta under 5k") out of the query,
    so the embedding only sees the description. Explicit UI filters take priority."""
    text_q = q
    if (m := _PRICE_MAX.search(text_q)) and f.max_price is None:
        f.max_price = _amount(m)
        text_q = text_q.replace(m.group(0), " ")
    if (m := _PRICE_MIN.search(text_q)) and f.min_price is None:
        f.min_price = _amount(m)
        text_q = text_q.replace(m.group(0), " ")
    if not f.store_ids:
        for store_id, name in stores:
            pattern = re.compile(r"\b" + re.escape(name.lower()) + r"\b")
            if pattern.search(text_q.lower()):
                f.store_ids.append(store_id)
                text_q = pattern.sub(" ", text_q.lower())
    if not f.gender:
        for g, pattern in _GENDER_WORDS.items():
            if re.search(pattern, text_q, re.I):
                f.gender = g
                break  # keep the word in the query too: it helps the embedding
    text_q = re.sub(r"\s+", " ", text_q).strip()
    return text_q or q
