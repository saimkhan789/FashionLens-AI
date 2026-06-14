from datetime import datetime


def history_document(user_email: str, query: str, query_type: str, results: list) -> dict:
    return {
        "user_email": user_email,
        "query": query,
        "query_type": query_type,
        "results": results,
        "created_at": datetime.utcnow(),
    }