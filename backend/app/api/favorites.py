from fastapi import APIRouter, HTTPException, Header
from app.services.favorites_service import add_favorite, remove_favorite, get_favorites
from app.schemas.favorites import FavoriteRequest, FavoritesResponse
from app.utils.jwt import decode_access_token

router = APIRouter(prefix="/favorites", tags=["favorites"])


def get_email_from_token(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]


@router.get("", response_model=FavoritesResponse)
async def fetch_favorites(authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    favorites = await get_favorites(email)
    return {"favorites": favorites, "total": len(favorites)}


@router.post("")
async def add_to_favorites(body: FavoriteRequest, authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    result = await add_favorite(email, body.product_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{product_id}")
async def remove_from_favorites(product_id: int, authorization: str = Header(...)):
    email = get_email_from_token(authorization)
    return await remove_favorite(email, product_id)