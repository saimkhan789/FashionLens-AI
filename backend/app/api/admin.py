from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import admin_user
from app.db import get_session
from app.ingest import pipeline
from app.ingest.platforms import normalize_store_url
from app.models import ImportJob, Product, Store
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
    return {"stores": [
        {
            "id": s.id, "name": s.name, "url": s.url, "platform": s.platform, "active": s.active,
            "searchable": s.product_count, "total": totals.get(s.id, 0),
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
