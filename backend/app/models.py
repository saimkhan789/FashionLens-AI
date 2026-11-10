from datetime import datetime, timezone
from decimal import Decimal

from pgvector.sqlalchemy import HALFVEC
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

EMBED_DIM = 768  # Marqo-FashionSigLIP


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # Null for accounts created through Google sign-in.
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Store(Base):
    """A brand's online shop whose catalogue we import."""
    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    url: Mapped[str] = mapped_column(String(500), unique=True)
    platform: Mapped[str | None] = mapped_column(String(40))  # shopify | woocommerce | generic
    currency: Mapped[str] = mapped_column(String(8), default="PKR")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    product_count: Mapped[int] = mapped_column(Integer, default=0)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    products: Mapped[list["Product"]] = relationship(back_populates="store", cascade="all, delete-orphan", passive_deletes=True)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("store_id", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(Text)
    product_type: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(40), index=True)
    gender: Mapped[str | None] = mapped_column(String(10), index=True)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), index=True)
    compare_at_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    image_url: Mapped[str] = mapped_column(Text)
    product_url: Mapped[str] = mapped_column(Text)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    # halfvec (16-bit floats) halves storage vs vector with no measurable loss in ranking.
    embedding: Mapped[list[float] | None] = mapped_column(HALFVEC(EMBED_DIM))
    # Which image the embedding was computed from, so re-syncs only re-embed changed images.
    embedded_image_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    store: Mapped[Store] = relationship(back_populates="products")


class Favorite(Base):
    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    product: Mapped[Product] = relationship()


class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    query_type: Mapped[str] = mapped_column(String(10))  # text | image
    query: Mapped[str] = mapped_column(Text)  # text query, or the image URL / "upload"
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | done | failed
    stage: Mapped[str | None] = mapped_column(String(40))  # fetching | embedding
    found: Mapped[int] = mapped_column(Integer, default=0)
    embedded: Mapped[int] = mapped_column(Integer, default=0)
    to_embed: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SearchEvent(Base):
    """One row per search (guest or signed in). Drives guest limits and admin stats;
    unlike SearchHistory, users can't clear it."""
    __tablename__ = "search_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    query_type: Mapped[str] = mapped_column(String(10))  # text | image
    query: Mapped[str | None] = mapped_column(String(300))  # text searches only
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    guest_id: Mapped[str | None] = mapped_column(String(32), index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(32), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ClickEvent(Base):
    """A visit to a brand's product page from FashionLens (logged by /api/go)."""
    __tablename__ = "click_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    source: Mapped[str | None] = mapped_column(String(20))  # search | image | similar | saved | history
    # Clicks are plain link navigations (no auth header), so they're tied to the browser
    # cookie only: enough to count unique visitors per brand.
    browser_id: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
