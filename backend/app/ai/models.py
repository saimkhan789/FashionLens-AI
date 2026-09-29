"""Loads the AI models once, in a background thread, so the API boots instantly.

- Embedder: Marqo-FashionSigLIP — a CLIP-style model fine-tuned on fashion products.
  Images and text land in the same 768-d space, so a photo or a description can
  be matched against product images.
- Detector: YOLOS trained on Fashionpedia — finds individual garments in a photo so
  we can search for each piece separately instead of one blurry "whole outfit" vector.
"""
import threading

import numpy as np
from PIL import Image

from app.config import settings

_ready = threading.Event()
_error: Exception | None = None
_lock = threading.Lock()  # CPU inference: run one batch at a time
_embed_model = _preprocess = _tokenizer = _detector = None


def _load() -> None:
    global _embed_model, _preprocess, _tokenizer, _detector, _error
    try:
        import open_clip
        import torch
        from transformers import pipeline

        print("[AI] Loading embedding model...")
        _embed_model, _, _preprocess = open_clip.create_model_and_transforms(settings.EMBED_MODEL)
        _embed_model.eval()
        _tokenizer = open_clip.get_tokenizer(settings.EMBED_MODEL)
        print("[AI] Loading garment detector...")
        _detector = pipeline("object-detection", model=settings.DETECT_MODEL)
        print("[AI] Models ready")
    except Exception as e:  # surfaced through status() / require_ready()
        _error = e
        print(f"[AI] Failed to load models: {e!r}")
    finally:
        _ready.set()


def start_loading() -> None:
    threading.Thread(target=_load, daemon=True, name="ai-loader").start()


def status() -> str:
    if not _ready.is_set():
        return "loading"
    return "error" if _error else "ready"


class ModelsNotReady(RuntimeError):
    pass


def require_ready(timeout: float = 0) -> None:
    if not _ready.wait(timeout) or _error:
        raise ModelsNotReady("AI models are still loading" if not _error else f"AI models failed to load: {_error}")


def embed_images(images: list[Image.Image]) -> np.ndarray:
    import torch

    require_ready(timeout=300)
    batch = torch.stack([_preprocess(img.convert("RGB")) for img in images])
    with _lock, torch.inference_mode():
        vecs = _embed_model.encode_image(batch, normalize=True)
    return vecs.cpu().numpy().astype("float32")


def embed_text(query: str) -> np.ndarray:
    import torch

    require_ready(timeout=300)
    with _lock, torch.inference_mode():
        vec = _embed_model.encode_text(_tokenizer([query]), normalize=True)
    return vec[0].cpu().numpy().astype("float32")


def detect_raw(image: Image.Image, threshold: float) -> list[dict]:
    import torch

    require_ready(timeout=300)
    with _lock, torch.inference_mode():
        return _detector(image, threshold=threshold)
