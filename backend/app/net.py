import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


def make_client(**kwargs) -> httpx.AsyncClient:
    kwargs.setdefault("follow_redirects", True)
    return httpx.AsyncClient(headers=HEADERS, timeout=20, **kwargs)


class UnsafeURL(ValueError):
    pass


async def ensure_public_url(url: str) -> str:
    """Rejects URLs pointing at localhost/private networks, since the server fetches
    user-supplied URLs (image links, store URLs)."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise UnsafeURL("Only http(s) links are supported")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(parts.hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise UnsafeURL("Could not resolve that link's host")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise UnsafeURL("That link points to a private address")
    return url
