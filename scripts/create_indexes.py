import asyncio
import sys
sys.path.append("backend")

from app.database.connection import connect_db, disconnect_db, get_database

async def create_indexes():
    await connect_db()
    db = get_database()
    await db["products"].create_index([("display_name", "text"), ("article_type", "text"), ("base_colour", "text")])
    await db["brand_products"].create_index([("display_name", "text"), ("product_type", "text"), ("brand", "text")])
    print("Done")
    await disconnect_db()

asyncio.run(create_indexes())