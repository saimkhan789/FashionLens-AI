from app.ai.similarity import search_by_image, search_by_text
from app.database.collections import get_collection, PRODUCTS_COLLECTION
from app.database.connection import get_database
from PIL import Image
from bson import ObjectId


async def run_image_search(image: Image.Image, top_k: int = 10) -> list:
    matches = search_by_image(image, top_k)
    return await enrich_results(matches)


async def run_text_search(query: str, top_k: int = 10) -> list:
    matches = search_by_text(query, top_k)
    return await enrich_results(matches)


async def enrich_results(matches: list) -> list:
    db = get_database()
    kaggle_collection = db[PRODUCTS_COLLECTION]
    brand_collection = db["brand_products"]

    results = []

    for m in matches:
        pid = m["product_id"]
        score = m["score"]

        # try kaggle products first (numeric id)
        try:
            numeric_id = int(pid)
            doc = await kaggle_collection.find_one({"product_id": numeric_id})
            if doc:
                results.append({
                    "product_id": numeric_id,
                    "score": score,
                    "display_name": doc.get("display_name", ""),
                    "article_type": doc.get("article_type", ""),
                    "base_colour": doc.get("base_colour", ""),
                    "gender": doc.get("gender", ""),
                    "master_category": doc.get("master_category", ""),
                    "sub_category": doc.get("sub_category", ""),
                    "image_path": doc.get("image_path", ""),
                    "source": "kaggle",
                    "brand": "",
                    "price": "",
                    "product_url": "",
                })
                continue
        except (ValueError, TypeError):
            pass

        # try brand products (ObjectId)
        try:
            doc = await brand_collection.find_one({"_id": ObjectId(str(pid))})
            if doc:
                results.append({
                    "product_id": str(doc["_id"]),
                    "score": score,
                    "display_name": doc.get("display_name", ""),
                    "article_type": doc.get("article_type", ""),
                    "base_colour": doc.get("base_colour", "unknown"),
                    "gender": doc.get("gender", "unisex"),
                    "master_category": doc.get("master_category", "apparel"),
                    "sub_category": doc.get("product_type", ""),
                    "image_path": "",
                    "source": "brand",
                    "brand": doc.get("brand", ""),
                    "price": doc.get("price", ""),
                    "product_url": doc.get("product_url", ""),
                    "image_url": doc.get("image_url", ""),
                })
        except Exception:
            continue

    return results