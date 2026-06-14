import bcrypt
from app.database.collections import get_collection, USERS_COLLECTION
from app.models.user import user_document
from app.utils.jwt import create_access_token


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

async def register_user(username: str, email: str, password: str) -> dict:
    collection = get_collection(USERS_COLLECTION)

    existing = await collection.find_one({"email": email})
    if existing:
        return {"error": "Email already registered"}

    hashed = hash_password(password)
    doc = user_document(username, email, hashed)
    await collection.insert_one(doc)

    token = create_access_token({"sub": email, "username": username})
    return {"access_token": token}


async def login_user(email: str, password: str) -> dict:
    collection = get_collection(USERS_COLLECTION)

    user = await collection.find_one({"email": email})
    if not user:
        return {"error": "Invalid credentials"}

    if not verify_password(password, user["hashed_password"]):
        return {"error": "Invalid credentials"}

    token = create_access_token({"sub": email, "username": user["username"]})
    return {"access_token": token}