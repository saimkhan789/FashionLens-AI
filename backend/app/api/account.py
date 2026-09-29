from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.db import get_session
from app.models import Favorite, Product, SearchHistory, Store, User
from app.search import product_out

router = APIRouter(tags=["account"])


class FavoriteRequest(BaseModel):
    product_id: int


@router.get("/favorites")
async def list_favorites(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(Product, Store.name).join(Favorite, Favorite.product_id == Product.id).join(Store)
        .where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())
    )).all()
    return {"favorites": [product_out(p, name) | {"available": p.available} for p, name in rows]}


@router.get("/favorites/ids")
async def favorite_ids(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Lets result grids show which products are already saved."""
    ids = (await session.scalars(select(Favorite.product_id).where(Favorite.user_id == user.id))).all()
    return {"ids": ids}


@router.post("/favorites")
async def add_favorite(body: FavoriteRequest, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    if not await session.get(Product, body.product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    await session.execute(insert(Favorite).values(user_id=user.id, product_id=body.product_id).on_conflict_do_nothing())
    await session.commit()
    return {"ok": True}


@router.delete("/favorites/{product_id}")
async def remove_favorite(product_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await session.execute(delete(Favorite).where(Favorite.user_id == user.id, Favorite.product_id == product_id))
    await session.commit()
    return {"ok": True}


@router.get("/history")
async def history(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(
        select(SearchHistory).where(SearchHistory.user_id == user.id).order_by(SearchHistory.created_at.desc()).limit(50)
    )).all()
    return {"history": [
        {"id": h.id, "query_type": h.query_type, "query": h.query, "result_count": h.result_count, "created_at": h.created_at}
        for h in rows
    ]}


@router.delete("/history")
async def clear_history(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await session.execute(delete(SearchHistory).where(SearchHistory.user_id == user.id))
    await session.commit()
    return {"ok": True}
