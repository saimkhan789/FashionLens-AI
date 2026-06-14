import os
import sys
import numpy as np
import faiss

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets", "processed")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "embeddings")

os.makedirs(MODELS_DIR, exist_ok=True)


def build():
    print("[FAISS] Loading embeddings...")
    image_embeddings = np.load(os.path.join(PROCESSED_DIR, "image_embeddings.npy")).astype("float32")
    product_ids = np.load(os.path.join(PROCESSED_DIR, "product_ids.npy"))

    print(f"[FAISS] Building index for {len(image_embeddings)} vectors of dim {image_embeddings.shape[1]}")

    faiss.normalize_L2(image_embeddings)

    index = faiss.IndexFlatIP(image_embeddings.shape[1])
    index.add(image_embeddings)

    faiss.write_index(index, os.path.join(MODELS_DIR, "faiss.index"))
    np.save(os.path.join(MODELS_DIR, "index_product_ids.npy"), product_ids)

    print(f"[FAISS] Index saved — {index.ntotal} vectors")


if __name__ == "__main__":
    build()