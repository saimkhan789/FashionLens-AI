from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import admin_user
from app.db import get_session
from app.ingest import pipeline
from app.ingest.platforms import normalize_store_url
from app.models import ClickEvent, ImportJob, Product, SearchEvent, Store, User
from app.net import UnsafeURL, ensure_public_url

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


class StoreCreate(BaseModel):
    url: str = Field(min_length=4)
    name: str | None = None


class StoreUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


def _job_out(j: ImportJob | None) -> dict | None:
    if j is None:
        return None
    return {
        "id": j.id, "status": j.status, "stage": j.stage, "found": j.found, "embedded": j.embedded,
        "to_embed": j.to_embed, "error": j.error, "created_at": j.created_at, "finished_at": j.finished_at,
    }


def _name_from_url(url: str) -> str:
    host = url.split("://", 1)[1].removeprefix("www.")
    return host.split(".")[0].replace("-", " ").title()


@router.get("/stores")
async def list_stores(session: AsyncSession = Depends(get_session)):
    stores = (await session.scalars(select(Store).order_by(Store.name))).all()
    # Latest job per store
    latest = (await session.execute(
        select(ImportJob).distinct(ImportJob.store_id).order_by(ImportJob.store_id, ImportJob.id.desc())
    )).scalars().all()
    by_store = {j.store_id: j for j in latest}
    totals = dict((await session.execute(select(Product.store_id, func.count()).group_by(Product.store_id))).all())
    embedded = dict((await session.execute(
        select(Product.store_id, func.count()).where(Product.embedding.is_not(None)).group_by(Product.store_id)
    )).all())
    searchable = dict((await session.execute(
        select(Product.store_id, func.count()).where(Product.embedding.is_not(None), Product.available)
        .group_by(Product.store_id)
    )).all())
    return {"stores": [
        {
            "id": s.id, "name": s.name, "url": s.url, "platform": s.platform, "active": s.active,
            "searchable": searchable.get(s.id, 0), "total": totals.get(s.id, 0), "embedded": embedded.get(s.id, 0),
            "last_synced_at": s.last_synced_at, "job": _job_out(by_store.get(s.id)),
        }
        for s in stores
    ]}


@router.post("/stores")
async def add_store(body: StoreCreate, session: AsyncSession = Depends(get_session)):
    url = normalize_store_url(body.url)
    try:
        await ensure_public_url(url)
    except UnsafeURL as e:
        raise HTTPException(status_code=400, detail=str(e))
    if await session.scalar(select(Store).where(Store.url == url)):
        raise HTTPException(status_code=400, detail="That store is already added")
    store = Store(url=url, name=(body.name or "").strip() or _name_from_url(url))
    session.add(store)
    await session.commit()
    job = await pipeline.enqueue(store.id)
    return {"id": store.id, "name": store.name, "url": store.url, "job": _job_out(job)}


@router.patch("/stores/{store_id}")
async def update_store(store_id: int, body: StoreUpdate, session: AsyncSession = Depends(get_session)):
    store = await session.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if body.name is not None and body.name.strip():
        store.name = body.name.strip()
    if body.active is not None:
        store.active = body.active
    await session.commit()
    return {"ok": True}


@router.post("/stores/{store_id}/sync")
async def sync_store(store_id: int, session: AsyncSession = Depends(get_session)):
    if not await session.get(Store, store_id):
        raise HTTPException(status_code=404, detail="Store not found")
    running = await session.scalar(select(ImportJob).where(ImportJob.store_id == store_id, ImportJob.status.in_(["queued", "running"])))
    if running:
        return {"job": _job_out(running)}
    return {"job": _job_out(await pipeline.enqueue(store_id))}


@router.delete("/stores/{store_id}")
async def delete_store(store_id: int, session: AsyncSession = Depends(get_session)):
    store = await session.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    await session.delete(store)
    await session.commit()
    return {"ok": True}


@router.get("/stats")
async def usage_stats(days: int = Query(default=30, ge=1, le=365), session: AsyncSession = Depends(get_session)):
    """Searches, sign-ups and brand clicks over the last `days` days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = lambda col: cast(func.timezone("Asia/Karachi", col), Date)  # noqa: E731  (PKT calendar days)

    s_day, is_guest = day(SearchEvent.created_at), SearchEvent.user_id.is_(None)
    searches = (await session.execute(
        select(s_day, SearchEvent.query_type, is_guest, func.count())
        .where(SearchEvent.created_at >= since).group_by(s_day, SearchEvent.query_type, is_guest)
    )).all()
    u_day = day(User.created_at)
    signups = dict((await session.execute(
        select(u_day, func.count()).where(User.created_at >= since).group_by(u_day)
    )).all())
    c_day = day(ClickEvent.created_at)
    clicks = dict((await session.execute(
        select(c_day, func.count()).where(ClickEvent.created_at >= since).group_by(c_day)
    )).all())

    today = datetime.now(timezone(timedelta(hours=5))).date()
    daily: dict[date, dict] = {
        today - timedelta(days=i): {"text": 0, "image": 0, "guest": 0, "signed_in": 0, "signups": 0, "clicks": 0}
        for i in range(days - 1, -1, -1)
    }
    for d, query_type, is_guest, n in searches:
        if d in daily:
            daily[d][query_type] += n
            daily[d]["guest" if is_guest else "signed_in"] += n
    for d, row in daily.items():
        row["signups"] = signups.get(d, 0)
        row["clicks"] = clicks.get(d, 0)

    top_brands = (await session.execute(
        select(Store.id, Store.name, func.count(ClickEvent.id), func.count(func.distinct(ClickEvent.browser_id)))
        .join(ClickEvent, ClickEvent.store_id == Store.id).where(ClickEvent.created_at >= since)
        .group_by(Store.id).order_by(func.count(ClickEvent.id).desc()).limit(20)
    )).all()
    top_queries = (await session.execute(
        select(func.lower(SearchEvent.query), func.count())
        .where(SearchEvent.created_at >= since, SearchEvent.query.is_not(None))
        .group_by(func.lower(SearchEvent.query)).order_by(func.count().desc()).limit(20)
    )).all()

    total = lambda key: sum(r[key] for r in daily.values())  # noqa: E731
    return {
        "days": days,
        "totals": {
            "searches": total("text") + total("image"),
            "text_searches": total("text"),
            "image_searches": total("image"),
            "guest_searches": total("guest"),
            "signups": total("signups"),
            "clicks": total("clicks"),
            "users": await session.scalar(select(func.count(User.id))),
            "searchable_products": await session.scalar(
                select(func.count(Product.id)).join(Store)
                .where(Product.available, Product.embedding.is_not(None), Store.active)),
        },
        "daily": [{"date": d.isoformat(), **row} for d, row in daily.items()],
        "top_brands": [{"id": i, "name": n, "clicks": c, "visitors": u} for i, n, c, u in top_brands],
        "top_queries": [{"query": q, "count": c} for q, c in top_queries],
    }
