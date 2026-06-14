from app.database.collections import get_collection, FAVORITES_COLLECTION, PRODUCTS_COLLECTION
from app.models.favorites import favorite_document


async def add_favorite(user_email: str, product_id: int) -> dict:
    collection = get_collection(FAVORITES_COLLECTION)
    existing = await collection.find_one({"user_email": user_email, "product_id": product_id})
    if existing:
        return {"error": "Already in favorites"}
    doc = favorite_document(user_email, product_id)
    await collection.insert_one(doc)
    return {"success": True}


async def remove_favorite(user_email: str, product_id: int) -> dict:
    collection = get_collection(FAVORITES_COLLECTION)
    await collection.delete_one({"user_email": user_email, "product_id": product_id})
    return {"success": True}


async def get_favorites(user_email: str) -> list:
    fav_collection = get_collection(FAVORITES_COLLECTION)
    prod_collection = get_collection(PRODUCTS_COLLECTION)

    favs = await fav_collection.find({"user_email": user_email}).to_list(length=100)
    product_ids = [f["product_id"] for f in favs]

    products = await prod_collection.find(
        {"product_id": {"$in": product_ids}}
    ).to_list(length=100)

    for p in products:
        p.pop("_id", None)

    return products