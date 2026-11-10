from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import ClickEvent, Product
from app.usage import GUEST_COOKIE

router = APIRouter(tags=["go"])

SOURCES = {"search", "image", "similar", "saved", "history"}


def _with_utm(url: str) -> str:
    if not settings.UTM_SOURCE:
        return url
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("utm_source", settings.UTM_SOURCE)
    query.setdefault("utm_medium", "referral")
    return urlunsplit(parts._replace(query=urlencode(query)))


@router.get("/go/{product_id}")
async def go_to_product(
    product_id: int,
    request: Request,
    src: str | None = Query(default=None, max_length=20),
    session: AsyncSession = Depends(get_session),
):
    """Product cards link here: logs the click (for admin stats), then redirects to
    the brand's product page. Only redirects to URLs stored in our catalogue."""
    product = await session.get(Product, product_id)
    if product is None or not product.product_url.startswith(("https://", "http://")):
        raise HTTPException(status_code=404, detail="Product not found")
    session.add(ClickEvent(
        product_id=product.id, store_id=product.store_id, source=src if src in SOURCES else None,
        browser_id=(request.cookies.get(GUEST_COOKIE) or "")[:32] or None,
    ))
    await session.commit()
    return RedirectResponse(_with_utm(product.product_url), status_code=302)
