from datetime import datetime


def user_document(username: str, email: str, hashed_password: str) -> dict:
    return {
        "username": username,
        "email": email,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
    }