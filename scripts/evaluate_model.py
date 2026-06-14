import asyncio
import sys
import os
import numpy as np
import json
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, accuracy_score
import faiss
import torch
from transformers import CLIPModel, CLIPProcessor
from PIL import Image
from tqdm import tqdm

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.connection import connect_db, disconnect_db, get_database

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "embeddings")
EVAL_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "evaluation")
DATASET_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

os.makedirs(EVAL_DIR, exist_ok=True)

CATEGORIES = [
    "tshirts", "shirts", "jeans", "tops", "shorts",
    "dresses", "shoes", "watches", "bags", "sandals"
]

EVAL_SAMPLES = 200


async def evaluate():
    await connect_db()
    db = get_database()
    collection = db["products"]

    print("[EVAL] Loading CLIP...")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model.eval()

    index = faiss.read_index(os.path.join(MODELS_DIR, "faiss.index"))
    product_ids = np.load(os.path.join(MODELS_DIR, "index_product_ids.npy"))

    id_to_category = {}
    docs = await collection.find(
        {"product_id": {"$in": [int(pid) for pid in product_ids]}}
    ).to_list(length=len(product_ids))
    for doc in docs:
        id_to_category[doc["product_id"]] = doc.get("article_type", "unknown")

    eval_docs = []
    for cat in CATEGORIES:
        cat_docs = [d for d in docs if d.get("article_type") == cat][:20]
        eval_docs.extend(cat_docs)

    print(f"[EVAL] Evaluating {len(eval_docs)} samples...")

    y_true = []
    y_pred = []

    for doc in tqdm(eval_docs, desc="Evaluating"):
        image_path = os.path.join(DATASET_ROOT, doc["image_path"].replace("/", os.sep))
        true_category = doc.get("article_type", "unknown")

        if true_category not in CATEGORIES:
            continue

        try:
            img = Image.open(image_path).convert("RGB")
            inputs = processor(images=img, return_tensors="pt")
            with torch.no_grad():
                vision_outputs = model.vision_model(pixel_values=inputs["pixel_values"])
                emb = model.visual_projection(vision_outputs.pooler_output)
            emb = emb.squeeze().cpu().numpy().astype("float32").reshape(1, -1)
            faiss.normalize_L2(emb)

            scores, indices = index.search(emb, 11)

            neighbor_ids = [int(product_ids[idx]) for idx in indices[0][1:] if idx != -1]
            neighbor_cats = [id_to_category.get(pid, "unknown") for pid in neighbor_ids]

            if neighbor_cats:
                pred_category = max(set(neighbor_cats), key=neighbor_cats.count)
            else:
                pred_category = "unknown"

            if pred_category in CATEGORIES:
                y_true.append(true_category)
                y_pred.append(pred_category)

        except Exception as e:
            continue

    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average="weighted", labels=CATEGORIES, zero_division=0)
    recall = recall_score(y_true, y_pred, average="weighted", labels=CATEGORIES, zero_division=0)
    f1 = f1_score(y_true, y_pred, average="weighted", labels=CATEGORIES, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=CATEGORIES)

    metrics = {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "confusion_matrix": cm.tolist(),
        "categories": CATEGORIES,
        "total_evaluated": len(y_true),
    }

    with open(os.path.join(EVAL_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f)

    print(f"[EVAL] Accuracy:  {accuracy:.4f}")
    print(f"[EVAL] Precision: {precision:.4f}")
    print(f"[EVAL] Recall:    {recall:.4f}")
    print(f"[EVAL] F1 Score:  {f1:.4f}")
    print(f"[EVAL] Saved to models/evaluation/metrics.json")

    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(evaluate())