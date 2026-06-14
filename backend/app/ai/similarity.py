import os
import numpy as np
import faiss
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "embeddings")

_index = None
_product_ids = None
_model = None
_processor = None


def load_resources():
    global _index, _product_ids, _model, _processor
    import threading

    def _load():
        global _index, _product_ids, _model, _processor
        _index = faiss.read_index(os.path.join(MODELS_DIR, "faiss.index"))
        _product_ids = np.load(os.path.join(MODELS_DIR, "index_product_ids.npy"))
        _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _model.eval()
        print("[SIMILARITY] Resources loaded")

    thread = threading.Thread(target=_load)
    thread.daemon = True
    thread.start()

def search_by_image(image: Image.Image, top_k: int = 10) -> list:
    inputs = _processor(images=image, return_tensors="pt")
    pixel_values = inputs["pixel_values"].to("cpu")
    with torch.no_grad():
        vision_outputs = _model.vision_model(pixel_values=pixel_values)
        emb = _model.visual_projection(vision_outputs.pooler_output)
    emb = emb.squeeze().cpu().numpy().astype("float32").reshape(1, -1)
    faiss.normalize_L2(emb)
    scores, indices = _index.search(emb, top_k)
    return [
        {"product_id": str(_product_ids[idx]), "score": float(scores[0][i])}
        for i, idx in enumerate(indices[0])
        if idx != -1
]


def search_by_text(query: str, top_k: int = 10) -> list:
    inputs = _processor(text=[query], return_tensors="pt", padding=True)
    with torch.no_grad():
        text_outputs = _model.text_model(**inputs)
        emb = _model.text_projection(text_outputs.pooler_output)
    emb = emb.squeeze().cpu().numpy().astype("float32").reshape(1, -1)
    faiss.normalize_L2(emb)
    scores, indices = _index.search(emb, top_k)
    return [
        {"product_id": str(_product_ids[idx]), "score": float(scores[0][i])}
        for i, idx in enumerate(indices[0])
        if idx != -1
]