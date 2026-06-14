from app.database.connection import get_database

USERS_COLLECTION = "users"
PRODUCTS_COLLECTION = "products"
HISTORY_COLLECTION = "search_history"
FAVORITES_COLLECTION = "favorites"
METRICS_COLLECTION = "metrics"


def get_collection(name: str):
    return get_database()[name]