"""Imports a store's catalogue: fetch products -> upsert -> embed product images.

Jobs run one at a time on a background asyncio worker inside the API process.
Re-syncing a store only re-embeds products whose image changed, and products that
disappeared from the store are marked unavailable so they drop out of search.
"""
import asyncio
import io
import traceback
from datetime import datetime, timezone

import httpx
from PIL import Image
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert

from app.ai import models as ai
from app.db import SessionLocal
from app.ingest.common import ProductData, classify
from app.ingest.platforms import READERS, detect_platform
from app.models import ImportJob, Product, Store
from app.net import make_client

EMBED_BATCH = 16
DOWNLOAD_CONCURRENCY = 16

_queue: asyncio.Queue[int] = asyncio.Queue()
_worker: asyncio.Task | None = None


def thumb_url(url: str) -> str:
    # Shopify's CDN resizes on the fly; downloading 400px images is ~10x faster than originals.
    if "cdn.shopify.com" in url or "/cdn/shop/" in url:
        return url + ("&" if "?" in url else "?") + "width=400"
    return url


async def _update_job(job_id: int, **values) -> None:
    async with SessionLocal() as s:
        await s.execute(update(ImportJob).where(ImportJob.id == job_id).values(**values))
        await s.commit()


async def _upsert(store: Store, batch: list[ProductData]) -> None:
    rows = []
    for p in batch:
        category, gender = classify(p.title, p.product_type, p.tags)
        rows.append({
            "store_id": store.id, "external_id": p.external_id[:200], "title": p.title,
            "product_type": (p.product_type or "")[:200] or None, "category": category, "gender": gender,
            "tags": p.tags, "price": p.price, "compare_at_price": p.compare_at_price,
            "image_url": p.image_url, "product_url": p.product_url, "available": p.available,
            "updated_at": datetime.now(timezone.utc),
        })
    # Generic readers can see the same product twice (e.g. URL variants) — last one wins.
    rows = list({r["external_id"]: r for r in rows}.values())
    stmt = insert(Product).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["store_id", "external_id"],
        set_={c: stmt.excluded[c] for c in rows[0] if c not in ("store_id", "external_id")},
    )
    async with SessionLocal() as s:
        await s.execute(stmt)
        await s.commit()


async def _download(client: httpx.AsyncClient, sem: asyncio.Semaphore, url: str) -> Image.Image | None:
    async with sem:
        try:
            r = await client.get(thumb_url(url))
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content))
            img.draft("RGB", (512, 512))  # fast JPEG downscale while decoding
            return img.convert("RGB")
        except Exception:
            return None


async def _embed_pending(job_id: int, store_id: int, client: httpx.AsyncClient) -> None:
    async with SessionLocal() as s:
        pending = (await s.execute(
            select(Product.id, Product.image_url).where(
                Product.store_id == store_id,
                or_(Product.embedding.is_(None), Product.embedded_image_url != Product.image_url),
            ).order_by(Product.id)
        )).all()
    await _update_job(job_id, stage="embedding", to_embed=len(pending), embedded=0)

    sem = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)
    done = 0
    for i in range(0, len(pending), EMBED_BATCH):
        chunk = pending[i:i + EMBED_BATCH]
        images = await asyncio.gather(*(_download(client, sem, url) for _, url in chunk))
        ok = [(pid, url, img) for (pid, url), img in zip(chunk, images) if img is not None]
        if ok:
            vecs = await asyncio.to_thread(ai.embed_images, [img for _, _, img in ok])
            async with SessionLocal() as s:
                for (pid, url, _), vec in zip(ok, vecs):
                    await s.execute(update(Product).where(Product.id == pid).values(embedding=vec, embedded_image_url=url))
                await s.commit()
        done += len(chunk)
        await _update_job(job_id, embedded=done)


async def run_job(job_id: int) -> None:
    async with SessionLocal() as s:
        job = await s.get(ImportJob, job_id)
        store = await s.get(Store, job.store_id)
    started = datetime.now(timezone.utc)
    await _update_job(job_id, status="running", stage="fetching", found=0, embedded=0, to_embed=0, error=None)
    print(f"[IMPORT] {store.name}: starting ({store.url})")

    try:
        async with make_client() as client:
            if not store.platform:
                store.platform = await detect_platform(client, store.url)
                async with SessionLocal() as s:
                    await s.execute(update(Store).where(Store.id == store.id).values(platform=store.platform))
                    await s.commit()

            found = 0
            async for batch in READERS[store.platform](client, store.url):
                if not batch:
                    continue
                await _upsert(store, batch)
                found += len(batch)
                await _update_job(job_id, found=found)
            if not found:
                raise RuntimeError(f"No products found (platform: {store.platform})")

            # Anything we didn't see this time was removed from the store.
            async with SessionLocal() as s:
                await s.execute(update(Product).where(Product.store_id == store.id, Product.updated_at < started).values(available=False))
                await s.commit()
            print(f"[IMPORT] {store.name}: {found} products, embedding images...")

            await _embed_pending(job_id, store.id, client)

        async with SessionLocal() as s:
            count = await s.scalar(select(func.count()).where(Product.store_id == store.id, Product.available, Product.embedding.is_not(None)))
            await s.execute(update(Store).where(Store.id == store.id).values(product_count=count, last_synced_at=datetime.now(timezone.utc)))
            await s.commit()
        await _update_job(job_id, status="done", stage=None, finished_at=datetime.now(timezone.utc))
        print(f"[IMPORT] {store.name}: done — {count} searchable products")
    except Exception as e:
        traceback.print_exc()
        await _update_job(job_id, status="failed", error=str(e)[:1000], finished_at=datetime.now(timezone.utc))


async def _work() -> None:
    while True:
        job_id = await _queue.get()
        try:
            await run_job(job_id)
        finally:
            _queue.task_done()


async def start_worker() -> None:
    global _worker
    # Imports only ever start from an explicit admin action (Add / Sync, or `run.py import`),
    # never on their own at startup. Jobs cut off by a restart are marked as interrupted.
    async with SessionLocal() as s:
        await s.execute(
            update(ImportJob).where(ImportJob.status.in_(["queued", "running"]))
            .values(status="failed", error="Interrupted by a server restart. Press Sync to run it again",
                    finished_at=datetime.now(timezone.utc))
        )
        await s.commit()
    _worker = asyncio.create_task(_work())


async def enqueue(store_id: int) -> ImportJob:
    async with SessionLocal() as s:
        job = ImportJob(store_id=store_id)
        s.add(job)
        await s.commit()
        await s.refresh(job)
    _queue.put_nowait(job.id)
    return job
