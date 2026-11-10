"""Who is searching, and how many free searches a guest has left.

Guests get a few free searches (settings.GUEST_*), then must sign in. They are
counted per browser (a long-lived cookie) and, more loosely, per IP per day, so
clearing cookies or going incognito doesn't reset the limit forever.
"""
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import optional_user
from app.config import settings
from app.models import SearchEvent, User

GUEST_COOKIE = "fl_guest"
_COOKIE_MAX_AGE = 60 * 60 * 24 * 365


@dataclass
class Visitor:
    user: User | None
    guest_id: str | None  # None for signed-in users
    ip_hash: str | None


def client_ip(request: Request) -> str | None:
    """The real client IP. Behind N proxies, the Nth entry from the right of
    X-Forwarded-For is the one our own proxy saw; anything left of it is client-supplied."""
    if settings.PROXY_HOPS > 0:
        hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
        if len(hops) >= settings.PROXY_HOPS:
            return hops[-settings.PROXY_HOPS]
    return request.client.host if request.client else None


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hmac.new(settings.JWT_SECRET.encode(), ip.encode(), hashlib.sha256).hexdigest()[:32]


async def visitor(request: Request, response: Response, user: User | None = Depends(optional_user)) -> Visitor:
    """FastAPI dependency. Gives every browser an id cookie on its first search; it
    counts guest searches and lets click stats tell unique visitors apart."""
    browser_id = request.cookies.get(GUEST_COOKIE)
    if not browser_id or len(browser_id) > 32:
        browser_id = secrets.token_urlsafe(16)
        response.set_cookie(GUEST_COOKIE, browser_id, max_age=_COOKIE_MAX_AGE, httponly=True,
                            samesite="lax", secure=settings.SECURE_COOKIES)
    return Visitor(user=user, guest_id=None if user else browser_id, ip_hash=_hash_ip(client_ip(request)))


_LIMITS = {
    "text": lambda: (settings.GUEST_TEXT_SEARCHES, settings.GUEST_IP_TEXT_PER_DAY),
    "image": lambda: (settings.GUEST_IMAGE_SEARCHES, settings.GUEST_IP_IMAGE_PER_DAY),
}


async def _used(session: AsyncSession, v: Visitor, query_type: str) -> tuple[int, int]:
    """(searches by this browser ever, searches from this IP by guests in the last 24h)"""
    by_browser = await session.scalar(select(func.count()).where(
        SearchEvent.guest_id == v.guest_id, SearchEvent.query_type == query_type))
    by_ip = 0
    if v.ip_hash:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        by_ip = await session.scalar(select(func.count()).where(
            SearchEvent.ip_hash == v.ip_hash, SearchEvent.user_id.is_(None),
            SearchEvent.query_type == query_type, SearchEvent.created_at >= since))
    return by_browser, by_ip


async def quota(session: AsyncSession, v: Visitor) -> dict | None:
    """Free searches left for a guest; None for signed-in users (unlimited)."""
    if v.user:
        return None
    left = {}
    for query_type, limits in _LIMITS.items():
        browser_limit, ip_limit = limits()
        by_browser, by_ip = await _used(session, v, query_type)
        left[f"{query_type}_left"] = max(0, min(browser_limit - by_browser, ip_limit - by_ip))
    return left


_LIMIT_MESSAGES = {
    "text": "You've used your free searches. Sign in to keep searching. It's free.",
    "image": "You've used your free photo search. Sign in to keep searching. It's free.",
}


async def ensure_allowed(session: AsyncSession, v: Visitor, query_type: str) -> None:
    if v.user:
        return
    browser_limit, ip_limit = _LIMITS[query_type]()
    by_browser, by_ip = await _used(session, v, query_type)
    if by_browser >= browser_limit or by_ip >= ip_limit:
        raise HTTPException(status_code=401, detail={
            "code": "guest_limit", "query_type": query_type, "message": _LIMIT_MESSAGES[query_type],
        })


async def record_search(session: AsyncSession, v: Visitor, query_type: str, query: str | None = None) -> None:
    session.add(SearchEvent(
        query_type=query_type, query=query[:300] if query else None,
        user_id=v.user.id if v.user else None, guest_id=v.guest_id, ip_hash=v.ip_hash,
    ))
    await session.commit()
