import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation


@dataclass
class ProductData:
    external_id: str
    title: str
    image_url: str
    product_url: str
    price: Decimal | None = None
    compare_at_price: Decimal | None = None
    product_type: str | None = None
    tags: list[str] = field(default_factory=list)
    available: bool = True
    currency: str | None = None


def to_decimal(value) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        d = Decimal(re.sub(r"[^\d.]", "", str(value)))
    except InvalidOperation:
        return None
    return d if d > 0 else None


# First match wins, so more specific categories come first
# (an "unstitched 3 piece lawn suit" mentions "shirt" in most titles).
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("home", ["bedsheet", "bed sheet", "duvet", "cushion", "curtain", "towel", "pillow", "quilt", "comforter", "table cloth", "napkin"]),
    ("beauty", ["perfume", "fragrance", "attar", "eau de", "body mist", "lotion", "lipstick", "cosmetic"]),
    ("unstitched", ["unstitched", "un-stitched", "unstiched"]),
    ("suit", ["3 piece", "3-piece", "3pc", "2 piece", "2-piece", "2pc", "shalwar kameez", "suit", "co-ord", "coord", "co ord"]),
    ("kurta", ["kurta", "kurti", "kameez"]),
    ("dress", ["dress", "maxi", "gown", "frock", "angrakha", "peshwas", "lehenga", "saree", "sari"]),
    ("outerwear", ["jacket", "coat", "blazer", "waistcoat", "hoodie", "sweatshirt", "sweater", "cardigan", "shrug", "cape", "poncho"]),
    ("dupatta", ["dupatta", "shawl", "stole", "scarf", "hijab"]),
    ("footwear", ["shoe", "sandal", "heel", "sneaker", "slipper", "khussa", "loafer", "boot", "chappal", "flats", "peshawari", "slides", "mules", "pumps", "kolhapuri"]),
    ("bag", ["bag", "clutch", "wallet", "purse", "tote", "pouch", "backpack"]),
    ("jewelry", ["earring", "necklace", "bangle", "bracelet", "jewel", "ring", "pendant", "anklet"]),
    ("skirt", ["skirt"]),
    ("bottoms", ["trouser", "pant", "shalwar", "culotte", "jeans", "palazzo", "tights", "shorts", "pajama", "pyjama", "jogger", "chino", "cargo", "denim", "legging", "sharara", "gharara"]),
    ("tops", ["shirt", "blouse", "top", "tee", "t-shirt", "polo", "tunic", "tank", "camisole", "henley"]),
]
# Categories hidden from search results by default — not clothing.
NON_APPAREL = {"home", "beauty"}

_GENDER_RULES = [
    ("kids", r"\b(kids?|boys?|girls?|baby|babies|infants?|toddlers?|junior|teens?)\b"),
    ("women", r"\b(wom[ae]n'?s?|ladies|lady|female|her|woman)\b"),
    ("men", r"\b(m[ae]n'?s?|gents?|male|him|man)\b"),
]


def _compile(words: list[str]) -> re.Pattern:
    return re.compile(r"\b(" + "|".join(re.escape(w) for w in words) + r")s?\b")


_CATEGORY_PATTERNS = [(cat, _compile(words)) for cat, words in CATEGORY_RULES]


def classify(title: str, product_type: str | None, tags: list[str]) -> tuple[str | None, str | None]:
    """Best-effort (category, gender) from the store's own text. The product type and
    tags are checked before the title because stores label those more consistently."""
    labelled = " ".join([product_type or "", " ".join(tags)]).lower()
    title_l = title.lower()

    category = None
    for text in (labelled, title_l):
        for cat, pattern in _CATEGORY_PATTERNS:
            if pattern.search(text):
                category = cat
                break
        if category:
            break

    gender = None
    for text in (labelled, title_l):
        for g, pattern in _GENDER_RULES:
            if re.search(pattern, text):
                gender = g
                break
        if gender:
            break
    return category, gender
