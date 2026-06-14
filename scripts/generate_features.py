import asyncio
import sys
import os
import numpy as np
from PIL import Image
from tqdm import tqdm
import torch
from transformers import CLIPModel, CLIPProcessor

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.connection import connect_db, disconnect_db, get_database

COLLECTION = "products"
DATASET_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROCESSED_DIR = os.path.join(DATASET_ROOT, "datasets", "processed")

os.makedirs(PROCESSED_DIR, exist_ok=True)


def get_image_embedding(model, processor, image_path: str, device):
    try:
        img = Image.open(image_path).convert("RGB")
        inputs = processor(images=img, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(device)
        with torch.no_grad():
            vision_outputs = model.vision_model(pixel_values=pixel_values)
            image_features = model.visual_projection(vision_outputs.pooler_output)
        return image_features.squeeze().cpu().numpy()
    except Exception as e:
        print(f"Error: {e}")
        return None


async def generate():
    await connect_db()
    db = get_database()
    collection = db[COLLECTION]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[FEATURES] Using device: {device}")

    print("[FEATURES] Loading CLIP...")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model.eval()
    print("[FEATURES] CLIP loaded")

    total = await collection.count_documents({})
    docs = await collection.find({}).to_list(length=total)
    docs = docs[:10000]
    print(f"[FEATURES] Processing {len(docs)} products")

    image_embeddings = []
    product_ids = []

    for doc in tqdm(docs, desc="Generating CLIP embeddings", unit="doc"):
        image_path = os.path.join(DATASET_ROOT, doc["image_path"].replace("/", os.sep))
        emb = get_image_embedding(model, processor, image_path, device)
        if emb is None:
            continue
        image_embeddings.append(emb)
        product_ids.append(doc["product_id"])

    np.save(os.path.join(PROCESSED_DIR, "image_embeddings.npy"), np.array(image_embeddings))
    np.save(os.path.join(PROCESSED_DIR, "product_ids.npy"), np.array(product_ids))

    print(f"[FEATURES] Saved {len(product_ids)} embeddings — dim: {np.array(image_embeddings).shape[1]}")
    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(generate())