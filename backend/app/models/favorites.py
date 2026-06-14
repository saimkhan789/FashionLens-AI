from datetime import datetime


def favorite_document(user_email: str, product_id: int) -> dict:
    return {
        "user_email": user_email,
        "product_id": product_id,
        "created_at": datetime.utcnow(),
    }