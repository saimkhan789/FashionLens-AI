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
        await _upgrade_schema(conn)
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS products_embedding_hnsw "
            "ON products USING hnsw (embedding halfvec_cosine_ops)"
        ))
    print("[DB] Ready")


async def _upgrade_schema(conn) -> None:
    """Brings databases created by earlier versions up to date. create_all only adds
    missing tables, not columns. Every statement here must be safe to re-run.
    TODO: replace with Alembic migrations."""
    from app.models import EMBED_DIM

    for stmt in (
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(64) UNIQUE",
        "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL",
    ):
        await conn.execute(text(stmt))

    # vector(768) -> halfvec(768): halves the size of every embedding and its index.
    coltype = await conn.scalar(text(
        "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
        "WHERE attrelid = 'products'::regclass AND attname = 'embedding'"
    ))
    if coltype and coltype.startswith("vector"):
        print("[DB] Converting embeddings to halfvec (one-time) ...")
        await conn.execute(text("DROP INDEX IF EXISTS products_embedding_hnsw"))
        await conn.execute(text(
            f"ALTER TABLE products ALTER COLUMN embedding TYPE halfvec({EMBED_DIM}) USING embedding::halfvec({EMBED_DIM})"
        ))
