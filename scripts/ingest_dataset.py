import pandas as pd
import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.connection import connect_db, disconnect_db, get_database

RAW_CSV = os.path.join(os.path.dirname(__file__), "..", "datasets", "raw", "styles.csv")
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets", "raw", "images")
COLLECTION = "products"


def load_and_validate(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, on_bad_lines="skip")

    required_columns = {"id", "gender", "masterCategory", "subCategory", "articleType", "baseColour", "season", "year", "usage", "productDisplayName"}
    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    before = len(df)
    df = df.dropna(subset=list(required_columns))
    df = df.drop_duplicates(subset=["id"])
    after = len(df)

    print(f"[VALIDATE] Rows before: {before} | after: {after} | dropped: {before - after}")

    valid_ids = []
    for _, row in df.iterrows():
        image_path = os.path.join(IMAGES_DIR, f"{int(row['id'])}.jpg")
        if os.path.exists(image_path):
            valid_ids.append(row["id"])

    df = df[df["id"].isin(valid_ids)]
    print(f"[VALIDATE] Records with images: {len(df)}")

    return df


def build_document(row) -> dict:
    return {
        "product_id": int(row["id"]),
        "gender": row["gender"],
        "master_category": row["masterCategory"],
        "sub_category": row["subCategory"],
        "article_type": row["articleType"],
        "base_colour": row["baseColour"],
        "season": row["season"],
        "year": str(row["year"]),
        "usage": row["usage"],
        "display_name": row["productDisplayName"],
        "image_path": f"datasets/raw/images/{int(row['id'])}.jpg",
    }


async def ingest():
    await connect_db()
    db = get_database()
    collection = db[COLLECTION]

    await collection.drop()
    print("[DB] Cleared existing products collection")

    df = load_and_validate(RAW_CSV)

    documents = [build_document(row) for _, row in df.iterrows()]

    if not documents:
        print("[ERROR] No valid documents to insert")
        return

    await collection.insert_many(documents)
    print(f"[DB] Inserted {len(documents)} products into MongoDB")

    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(ingest())