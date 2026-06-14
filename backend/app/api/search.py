from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Header
from app.schemas.search import SearchResponse
from app.services.search_service import run_image_search, run_text_search
from app.services.history_service import save_search
from app.utils.jwt import decode_access_token
from PIL import Image
import io

router = APIRouter(prefix="/search", tags=["search"])


def get_email_from_token(authorization: str) -> str | None:
    try:
        if not authorization or not authorization.startswith("Bearer "):
            return None
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        return payload["sub"] if payload else None
    except Exception:
        return None


@router.post("/image", response_model=SearchResponse)
async def image_search(
    file: UploadFile = File(...),
    top_k: int = Query(default=10, le=50),
    authorization: str = Header(default=None)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    results = await run_image_search(image, top_k)
    email = get_email_from_token(authorization)
    if email:
        await save_search(email, "image_upload", "image", results)
    return {"results": results, "total": len(results)}


@router.get("/text", response_model=SearchResponse)
async def text_search(
    q: str = Query(..., min_length=1),
    top_k: int = Query(default=10, le=50),
    authorization: str = Header(default=None)
):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    results = await run_text_search(q, top_k)
    email = get_email_from_token(authorization)
    if email:
        await save_search(email, q, "text", results)
    return {"results": results, "total": len(results)}