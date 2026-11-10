from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, current_user, hash_password, verify_password
from app.config import settings
from app.db import get_session
from app.google_auth import InvalidGoogleToken, verify_id_token
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)  # the ID token from Google's button


def _sync_admin(user: User) -> bool:
    """ADMIN_EMAILS can change after sign-up; returns True if the flag changed."""
    is_admin = user.email in settings.admin_emails or user.is_admin
    changed = is_admin != user.is_admin
    user.is_admin = is_admin
    return changed


def _user_out(user: User) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email, "is_admin": user.is_admin}


def _token_response(user: User) -> dict:
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": _user_out(user)}


@router.post("/register")
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    email = body.email.lower()
    if await session.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(username=body.username, email=email, hashed_password=hash_password(body.password),
                is_admin=email in settings.admin_emails)
    session.add(user)
    await session.commit()
    return _token_response(user)


@router.post("/login")
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    user = await session.scalar(select(User).where(User.email == body.email.lower()))
    if user and not user.hashed_password:
        raise HTTPException(status_code=401, detail="This account uses Google sign-in. Continue with Google instead")
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if _sync_admin(user):
        await session.commit()
    return _token_response(user)


@router.post("/google")
async def google_login(body: GoogleLoginRequest, session: AsyncSession = Depends(get_session)):
    """Signs in (or signs up) with a Google account. An existing email/password
    account with the same verified email is linked rather than duplicated."""
    try:
        claims = await verify_id_token(body.credential)
    except InvalidGoogleToken:
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again")
    email = claims["email"].lower()
    user = await session.scalar(select(User).where(User.google_sub == claims["sub"]))
    if user is None:
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            name = (claims.get("name") or email.split("@")[0])[:80]
            user = User(username=name, email=email, hashed_password=None)
            session.add(user)
        user.google_sub = claims["sub"]
    _sync_admin(user)
    await session.commit()
    return _token_response(user)


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return _user_out(user)
