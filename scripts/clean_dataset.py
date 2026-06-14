import asyncio
import sys
import os
import re
from tqdm import tqdm

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.connection import connect_db, disconnect_db, get_database
from pymongo import UpdateOne

COLLECTION = "products"

GENDER_MAP = {"Men": "men", "Women": "women", "Boys": "boys", "Girls": "girls", "Unisex": "unisex"}
SEASON_MAP = {"Summer": "summer", "Winter": "winter", "Spring": "spring", "Fall": "fall"}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


async def clean():
    await connect_db()
    db = get_database()
    collection = db[COLLECTION]

    total = await collection.count_documents({})
    print(f"[CLEAN] Total documents: {total}")

    cursor = collection.find({})
    docs = await cursor.to_list(length=total)

    bulk = []
    for doc in tqdm(docs, desc="Cleaning", unit="doc"):
        updates = {
            "display_name": clean_text(doc.get("display_name", "")),
            "gender": GENDER_MAP.get(doc.get("gender", ""), doc.get("gender", "").lower().strip()),
            "season": SEASON_MAP.get(doc.get("season", ""), doc.get("season", "").lower().strip()),
            "article_type": clean_text(doc.get("article_type", "")).lower(),
            "master_category": clean_text(doc.get("master_category", "")).lower(),
            "sub_category": clean_text(doc.get("sub_category", "")).lower(),
            "base_colour": clean_text(doc.get("base_colour", "")).lower(),
            "usage": clean_text(doc.get("usage", "")).lower(),
        }
        bulk.append(UpdateOne({"_id": doc["_id"]}, {"$set": updates}))

    print("[CLEAN] Writing to DB...")
    result = await collection.bulk_write(bulk, ordered=False)
    print(f"[CLEAN] Modified: {result.modified_count}")

    await collection.create_index("product_id", unique=True)
    print("[CLEAN] Index created on product_id")
    print(f"[CLEAN] Final count: {await collection.count_documents({})}")

    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(clean())