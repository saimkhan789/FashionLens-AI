"""Turns raw Fashionpedia detections into the shoppable items in a photo."""
from dataclasses import dataclass

from PIL import Image

from app.ai.models import detect_raw

# Fashionpedia label -> the item name we show. Garment *parts* (sleeve, collar, ...)
# and accessories local brands don't really sell are left out.
ITEM_LABELS = {
    "shirt, blouse": "Shirt",
    "top, t-shirt, sweatshirt": "Top",
    "sweater": "Sweater",
    "cardigan": "Cardigan",
    "jacket": "Jacket",
    "vest": "Vest",
    "pants": "Trousers",
    "shorts": "Shorts",
    "skirt": "Skirt",
    "coat": "Coat",
    "dress": "Dress",
    "jumpsuit": "Jumpsuit",
    "cape": "Cape",
    "hat": "Hat",
    "shoe": "Shoes",
    "bag, wallet": "Bag",
    "scarf": "Scarf / Dupatta",
}
UPPER_BODY = {"Shirt", "Top", "Sweater", "Cardigan", "Jacket", "Vest", "Coat", "Dress", "Jumpsuit", "Cape"}
# When the detector only sees pieces of a top (common with kurtas and loose shirts),
# we merge these parts into one "Top" box.
TOP_PARTS = {"sleeve", "collar", "neckline", "lapel"}

THRESHOLD = 0.6
MIN_AREA_FRACTION = 0.003

ACCESSORY_CATEGORIES = {"footwear", "bag", "jewelry"}


def category_scope(label: str) -> tuple[set[str] | None, set[str]]:
    """(only these categories, never these) for an item's matches, so a detected
    top isn't matched with a handbag that happens to share its colour."""
    if label == "Shoes":
        return {"footwear"}, set()
    if label == "Bag":
        return {"bag"}, set()
    if label == "Full look":
        return None, set()
    return None, ACCESSORY_CATEGORIES


@dataclass
class Item:
    label: str
    score: float
    box: tuple[int, int, int, int]  # x0, y0, x1, y1 in image pixels

    def crop(self, image: Image.Image, pad: float = 0.08) -> Image.Image:
        x0, y0, x1, y1 = self.box
        px, py = (x1 - x0) * pad, (y1 - y0) * pad
        return image.crop((
            max(0, int(x0 - px)), max(0, int(y0 - py)),
            min(image.width, int(x1 + px)), min(image.height, int(y1 + py)),
        ))


def _box(d: dict) -> tuple[int, int, int, int]:
    b = d["box"]
    return b["xmin"], b["ymin"], b["xmax"], b["ymax"]


def detect_items(image: Image.Image) -> list[Item]:
    raw = detect_raw(image, THRESHOLD)
    min_area = image.width * image.height * MIN_AREA_FRACTION

    best: dict[str, Item] = {}  # one item per label: an outfit rarely has two tops
    parts = []
    for d in raw:
        label = ITEM_LABELS.get(d["label"])
        x0, y0, x1, y1 = _box(d)
        if label is None:
            if d["label"] in TOP_PARTS:
                parts.append((x0, y0, x1, y1))
            continue
        if (x1 - x0) * (y1 - y0) < min_area:
            continue
        if label not in best or d["score"] > best[label].score:
            best[label] = Item(label, float(d["score"]), (x0, y0, x1, y1))

    if parts and not UPPER_BODY & best.keys():
        box = (min(p[0] for p in parts), min(p[1] for p in parts), max(p[2] for p in parts), max(p[3] for p in parts))
        if (box[2] - box[0]) * (box[3] - box[1]) >= min_area:
            best["Top"] = Item("Top", 0.6, box)

    # Top-to-bottom reading order: hat, top, trousers, shoes...
    return sorted(best.values(), key=lambda i: (i.box[1] + i.box[3]) / 2)
