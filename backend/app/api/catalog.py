from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.ingest.common import NON_APPAREL
from app.models import Product, Store

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/facets")
async def facets(session: AsyncSession = Depends(get_session)):
    """What the filter bar can offer: brands and categories that have searchable products."""
    searchable = (Product.available, Product.embedding.is_not(None), Store.active)
    brands = (await session.execute(
        select(Store.id, Store.name, func.count(Product.id))
        .join(Product).where(*searchable).group_by(Store.id).order_by(Store.name)
    )).all()
    categories = (await session.execute(
        select(Product.category, func.count(Product.id))
        .join(Store).where(*searchable, Product.category.is_not(None), Product.category.not_in(NON_APPAREL))
        .group_by(Product.category).order_by(func.count(Product.id).desc())
    )).all()
    return {
        "brands": [{"id": i, "name": n, "count": c} for i, n, c in brands],
        "categories": [{"id": cat, "count": c} for cat, c in categories],
        "total": sum(c for _, _, c in brands),
    }
