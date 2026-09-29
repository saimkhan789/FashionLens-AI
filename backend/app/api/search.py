import asyncio
import io
import secrets
from collections import OrderedDict
from dataclasses import replace
from decimal import Decimal
from urllib.parse import urljoin

import httpx
import numpy as np
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import models as ai
from app.ai.detection import category_scope, detect_items
from app.auth import optional_user
from app.db import get_session
from app.models import Product, SearchHistory, Store, User
from app.net import UnsafeURL, ensure_public_url, make_client
from app.search import Filters, parse_query, product_out, vector_search

router = APIRouter(prefix="/search", tags=["search"])

PAGE = 24
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_SIDE = 1024

# Image searches are expensive (detection + one embedding per item), so their vectors
# are kept for a while: paging and filter changes then reuse them via /search/results.
_cache: OrderedDict[str, list[tuple[str, np.ndarray]]] = OrderedDict()
_CACHE_SIZE = 500


def _remember(vectors: list[tuple[str, np.ndarray]]) -> str:
    search_id = secrets.token_urlsafe(12)
    _cache[search_id] = vectors
    while len(_cache) > _CACHE_SIZE:
        _cache.popitem(last=False)
    return search_id


def filters_dep(
    brand: list[int] = Query(default=[]),
    category: list[str] = Query(default=[]),
    gender: str | None = Query(default=None, pattern="^(women|men|kids)$"),
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
    sort: str = Query(default="relevance", pattern="^(relevance|price_asc|price_desc)$"),
) -> Filters:
    return Filters(store_ids=brand, categories=category, gender=gender, min_price=min_price, max_price=max_price, sort=sort)


def _require_models():
    try:
        ai.require_ready()
    except ai.ModelsNotReady as e:
        raise HTTPException(status_code=503, detail=str(e))


async def _save_history(session: AsyncSession, user: User | None, query_type: str, query: str, count: int):
    if user:
        session.add(SearchHistory(user_id=user.id, query_type=query_type, query=query[:2000], result_count=count))
        await session.commit()


@router.get("/text")
async def text_search(
    q: str = Query(min_length=1, max_length=300),
    offset: int = Query(default=0, ge=0, le=500),
    limit: int = Query(default=PAGE, ge=1, le=60),
    f: Filters = Depends(filters_dep),
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(optional_user),
):
    _require_models()
    stores = (await session.execute(select(Store.id, Store.name).where(Store.active))).all()
    query = parse_query(q, stores, f)
    vec = await asyncio.to_thread(ai.embed_text, query)
    results, has_more = await vector_search(session, vec, f, offset, limit)
    if offset == 0:
        await _save_history(session, user, "text", q, len(results))
    return {"query": query, "filters": f.as_dict(), "results": results, "has_more": has_more}


async def _fetch_image_url(url: str) -> bytes:
    """Downloads an image link. Page links (a Pinterest pin, a product page) are
    resolved to the page's main image via its og:image tag."""
    async with make_client(follow_redirects=False) as client:
        for _ in range(2):  # the link itself, then the og:image it points to
            for _hop in range(5):  # follow redirects by hand so every hop is checked
                await ensure_public_url(url)
                r = await client.get(url)
                if r.is_redirect:
                    url = urljoin(url, r.headers["location"])
                    continue
                break
            if r.status_code != 200:
                raise HTTPException(status_code=400, detail="Couldn't open that link")
            ctype = r.headers.get("content-type", "")
            if ctype.startswith("image/"):
                return r.content
            if "html" not in ctype:
                break
            soup = BeautifulSoup(r.text, "html.parser")
            og = soup.find("meta", attrs={"property": "og:image"}) or soup.find("meta", attrs={"name": "og:image"})
            if not og or not og.get("content"):
                break
            url = urljoin(url, og["content"])
    raise HTTPException(status_code=400, detail="Couldn't find an image at that link")


def _open_image(data: bytes) -> Image.Image:
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (max 15 MB)")
    try:
        img = Image.open(io.BytesIO(data))
        img.draft("RGB", (MAX_SIDE, MAX_SIDE))
        img = img.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="That file isn't an image we can read")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    return img


def _scoped(f: Filters, label: str) -> Filters:
    scope, exclude = category_scope(label)
    return replace(f, scope=scope, exclude=exclude)


def _analyze(img: Image.Image) -> tuple[list[dict], list[tuple[str, np.ndarray]]]:
    items = detect_items(img)
    crops = [it.crop(img) for it in items] + [img]
    vectors = ai.embed_images(crops)
    w, h = img.size
    described = [
        {"label": it.label, "box": [it.box[0] / w, it.box[1] / h, it.box[2] / w, it.box[3] / h]}
        for it in items
    ] + [{"label": "Full look", "box": None}]
    return described, [(d["label"], v) for d, v in zip(described, vectors)]


@router.post("/image")
async def image_search(
    file: UploadFile | None = File(default=None),
    image_url: str | None = Form(default=None),
    f: Filters = Depends(filters_dep),
    session: AsyncSession = Depends(get_session),
    user: User | None = Depends(optional_user),
):
    """Finds every garment in the photo and returns matches for each one.
    Accepts an uploaded file or a link (image URL, Pinterest pin, product page)."""
    _require_models()
    if file is not None:
        data = await file.read(MAX_IMAGE_BYTES + 1)
    elif image_url:
        try:
            data = await _fetch_image_url(image_url.strip())
        except UnsafeURL as e:
            raise HTTPException(status_code=400, detail=str(e))
        except httpx.HTTPError:
            raise HTTPException(status_code=400, detail="Couldn't download that link")
    else:
        raise HTTPException(status_code=400, detail="Upload an image or paste a link")

    img = _open_image(data)
    items, vectors = await asyncio.to_thread(_analyze, img)
    search_id = _remember(vectors)

    for item, (label, vec) in zip(items, vectors):
        item["results"], item["has_more"] = await vector_search(session, vec, _scoped(f, label), 0, PAGE)
    await _save_history(session, user, "image", image_url or "upload", len(items[0]["results"]))
    return {"search_id": search_id, "filters": f.as_dict(), "items": items}


@router.get("/results")
async def more_results(
    search_id: str,
    item: int = Query(default=0, ge=0),
    offset: int = Query(default=0, ge=0, le=500),
    limit: int = Query(default=PAGE, ge=1, le=60),
    f: Filters = Depends(filters_dep),
    session: AsyncSession = Depends(get_session),
):
    """Another page, or re-filtered results, for one item of an earlier image search."""
    vectors = _cache.get(search_id)
    if vectors is None or item >= len(vectors):
        raise HTTPException(status_code=410, detail="This search expired — please search again")
    label, vec = vectors[item]
    results, has_more = await vector_search(session, vec, _scoped(f, label), offset, limit)
    return {"filters": f.as_dict(), "results": results, "has_more": has_more}


@router.get("/similar/{product_id}")
async def similar_products(
    product_id: int,
    offset: int = Query(default=0, ge=0, le=500),
    limit: int = Query(default=PAGE, ge=1, le=60),
    f: Filters = Depends(filters_dep),
    session: AsyncSession = Depends(get_session),
):
    row = (await session.execute(select(Product, Store.name).join(Store).where(Product.id == product_id))).first()
    if row is None or row[0].embedding is None:
        raise HTTPException(status_code=404, detail="Product not found")
    product, store_name = row
    results, has_more = await vector_search(session, np.asarray(product.embedding), f, offset, limit, exclude_id=product.id)
    return {"product": product_out(product, store_name), "results": results, "has_more": has_more}
