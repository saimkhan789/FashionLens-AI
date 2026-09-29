from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


def _engine_args(url: str) -> tuple[str, dict]:
    # asyncpg doesn't understand libpq's sslmode/channel_binding params that
    # hosted Postgres (Neon, Supabase) put in their connection strings.
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    connect_args = {}
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = True
    return urlunsplit(parts._replace(query=urlencode(query))), connect_args


_url, _connect_args = _engine_args(settings.async_database_url)
engine = create_async_engine(_url, connect_args=_connect_args, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from app import models  # noqa: F401  (registers tables on Base.metadata)

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS products_embedding_hnsw "
            "ON products USING hnsw (embedding vector_cosine_ops)"
        ))
    print("[DB] Ready")
