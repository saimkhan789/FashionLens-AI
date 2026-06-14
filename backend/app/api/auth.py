from fastapi import APIRouter, HTTPException
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services.auth_service import register_user, login_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    result = await register_user(body.username, body.email, body.password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"access_token": result["access_token"]}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    result = await login_user(body.email, body.password)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return {"access_token": result["access_token"]}