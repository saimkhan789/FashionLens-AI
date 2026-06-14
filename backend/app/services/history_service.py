from app.database.collections import get_collection, HISTORY_COLLECTION
from app.models.history import history_document


async def save_search(user_email: str, query: str, query_type: str, results: list):
    collection = get_collection(HISTORY_COLLECTION)
    doc = history_document(user_email, query, query_type, results)
    await collection.insert_one(doc)


async def get_history(user_email: str) -> list:
    collection = get_collection(HISTORY_COLLECTION)
    cursor = collection.find({"user_email": user_email}).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    for doc in docs:
        doc.pop("_id", None)
    return docs