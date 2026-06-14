import asyncio
import sys
import os
import numpy as np
import faiss
import torch
from transformers import CLIPModel, CLIPProcessor
from tqdm import tqdm

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.connection import connect_db, disconnect_db, get_database

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "embeddings"))
PROCESSED_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "datasets", "processed"))


async def generate():
    await connect_db()
    db = get_database()
    collection = db["brand_products"]

    total = await collection.count_documents({})
    docs = await collection.find({}).to_list(length=total)
    print(f"[BRAND] Loaded {len(docs)} brand products")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[BRAND] Loading CLIP on {device}...")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model.eval()
    print("[BRAND] CLIP loaded")

    embeddings = []
    product_ids = []

    for doc in tqdm(docs, desc="Generating brand embeddings"):
        text = f"{doc.get('display_name', '')} {doc.get('product_type', '')} {doc.get('brand', '')}"
        text = text.strip()
        if not text:
            continue
        try:
            inputs = processor(text=[text], return_tensors="pt", padding=True, truncation=True, max_length=77).to(device)
            with torch.no_grad():
                outputs = model.text_model(**inputs)
                emb = model.text_projection(outputs.pooler_output)
            emb = emb.squeeze().cpu().numpy().astype("float32")
            embeddings.append(emb)
            product_ids.append(str(doc["_id"]))
        except Exception as e:
            continue

    embeddings = np.array(embeddings)
    faiss.normalize_L2(embeddings)

    existing_index = faiss.read_index(os.path.join(MODELS_DIR, "faiss.index"))
    existing_ids = np.load(os.path.join(MODELS_DIR, "index_product_ids.npy"))

    existing_vectors = faiss.rev_swig_ptr(existing_index.get_xb(), existing_index.ntotal * existing_index.d)
    existing_vectors = np.array(existing_vectors).reshape(existing_index.ntotal, existing_index.d).astype("float32")

    all_vectors = np.vstack([existing_vectors, embeddings])
    all_ids = np.concatenate([existing_ids.astype(str), np.array(product_ids)])

    new_index = faiss.IndexFlatIP(all_vectors.shape[1])
    faiss.normalize_L2(all_vectors)
    new_index.add(all_vectors)

    faiss.write_index(new_index, os.path.join(MODELS_DIR, "faiss.index"))
    np.save(os.path.join(MODELS_DIR, "index_product_ids.npy"), all_ids)

    print(f"[BRAND] Index now has {new_index.ntotal} total vectors")
    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(generate())