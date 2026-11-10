"""Verifies Google Identity Services ID tokens (the "Sign in with Google" button).

The browser gets a signed JWT from Google and posts it to /api/auth/google. We check
the signature against Google's published keys, plus the audience, issuer and expiry.
"""
import time

import httpx
from jose import JWTError, jwt

from app.config import settings

_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
_KEYS_TTL = 60 * 60

_keys: dict[str, dict] = {}
_keys_fetched_at = 0.0


class InvalidGoogleToken(ValueError):
    pass


async def _signing_key(kid: str) -> dict:
    global _keys, _keys_fetched_at
    # Refetch when stale, or when Google has rotated in a key we haven't seen yet.
    if kid not in _keys or time.time() - _keys_fetched_at > _KEYS_TTL:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(_CERTS_URL)
            r.raise_for_status()
        _keys = {k["kid"]: k for k in r.json()["keys"]}
        _keys_fetched_at = time.time()
    if kid not in _keys:
        raise InvalidGoogleToken("Unknown signing key")
    return _keys[kid]


async def verify_id_token(token: str) -> dict:
    """Returns the token's claims (sub, email, name, picture ...) if it's valid."""
    if not settings.GOOGLE_CLIENT_ID:
        raise InvalidGoogleToken("Google sign-in isn't configured")
    try:
        kid = jwt.get_unverified_header(token).get("kid", "")
        key = await _signing_key(kid)
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=settings.GOOGLE_CLIENT_ID,
                            options={"verify_at_hash": False})
    except (JWTError, httpx.HTTPError, KeyError) as e:
        raise InvalidGoogleToken(str(e)) from e
    if claims.get("iss") not in _ISSUERS:
        raise InvalidGoogleToken("Wrong issuer")
    if not claims.get("email") or not claims.get("email_verified"):
        raise InvalidGoogleToken("Google account has no verified email")
    return claims
