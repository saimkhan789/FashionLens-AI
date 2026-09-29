from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, current_user, hash_password, verify_password
from app.config import settings
from app.db import get_session
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # ADMIN_EMAILS can be changed after sign-up; keep the flag in sync.
    is_admin = user.email in settings.admin_emails or user.is_admin
    if is_admin != user.is_admin:
        user.is_admin = is_admin
        await session.commit()
    return _token_response(user)


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return _user_out(user)
