from fastapi import APIRouter, HTTPException, Header
from app.services.history_service import get_history
from app.utils.jwt import decode_access_token
from app.schemas.history import HistoryResponse

router = APIRouter(prefix="/history", tags=["history"])


def get_email_from_token(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]


@router.get("", response_model=HistoryResponse)
async def fetch_history(authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    history = await get_history(email)
    return {"history": history, "total": len(history)}