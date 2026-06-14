import asyncio
import sys
import os
import requests
import time
from tqdm import tqdm
from pymongo import UpdateOne
from bs4 import BeautifulSoup

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.connection import connect_db, disconnect_db, get_database

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
}

BRANDS = [
    {"name": "Khaadi",           "url": "https://www.khaadi.com"},
    {"name": "Sapphire",         "url": "https://www.sapphireonline.pk"},
    {"name": "Gul Ahmed",        "url": "https://www.gulahmedshop.com"},
    {"name": "Nishat Linen",     "url": "https://nishatlinen.com"},
    {"name": "Alkaram Studio",   "url": "https://www.alkaramstudio.com"},
    {"name": "Outfitters",       "url": "https://outfitters.com.pk"},
    {"name": "Junaid Jamshed",   "url": "https://www.junaidjamshed.com"},
    {"name": "Bonanza Satrangi", "url": "https://www.bonanzasatrangi.com"},
    {"name": "Limelight",        "url": "https://www.limelight.pk"},
    {"name": "Beechtree",        "url": "https://www.beechtree.pk"},
]


def fetch_products_page(base_url: str, page: int) -> list:
    url = f"{base_url}/products.json?limit=250&page={page}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return []
        data = r.json()
        return data.get("products", [])
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []


def parse_product(product: dict, brand_name: str, brand_url: str) -> dict:
    title = product.get("title", "")
    product_type = product.get("product_type", "")
    tags = product.get("tags", [])
    handle = product.get("handle", "")

    variants = product.get("variants", [])
    price = variants[0].get("price") if variants else None

    images = product.get("images", [])
    image_url = images[0].get("src") if images else None

    return {
        "brand": brand_name,
        "display_name": title,
        "product_type": product_type,
        "tags": tags,
        "price": price,
        "image_url": image_url,
        "product_url": f"{brand_url}/products/{handle}",
        "source": "scraped",
        "article_type": product_type.lower() if product_type else "unknown",
        "master_category": "apparel",
        "gender": "unisex",
        "base_colour": "unknown",
    }


def scrape_brand_shopify(brand: dict) -> list:
    products = []
    page = 1
    while True:
        items = fetch_products_page(brand["url"], page)
        if not items:
            break
        for item in items:
            products.append(parse_product(item, brand["name"], brand["url"]))
        if len(items) < 250:
            break
        page += 1
        time.sleep(0.3)
    return products


def scrape_brand_html(brand: dict) -> list:
    products = []
    try:
        r = requests.get(brand["url"], headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")

        cards = soup.select("div[class*='product'], li[class*='product'], article[class*='product']")

        for card in cards[:100]:
            name_el = card.select_one("h2, h3, h4, [class*='title'], [class*='name']")
            price_el = card.select_one("[class*='price']")
            img_el = card.select_one("img")
            link_el = card.select_one("a[href]")

            name = name_el.get_text(strip=True) if name_el else None
            if not name:
                continue

            price = price_el.get_text(strip=True) if price_el else None
            img = None
            if img_el:
                img = img_el.get("src") or img_el.get("data-src") or img_el.get("data-lazy-src")
                if img and img.startswith("//"):
                    img = "https:" + img
                if img and img.startswith("data:"):
                    img = None

            link = link_el["href"] if link_el else ""
            if link and not link.startswith("http"):
                link = brand["url"] + link

            products.append({
                "brand": brand["name"],
                "display_name": name,
                "product_type": "unknown",
                "tags": [],
                "price": price,
                "image_url": img,
                "product_url": link,
                "source": "scraped_html",
                "article_type": "unknown",
                "master_category": "apparel",
                "gender": "unisex",
                "base_colour": "unknown",
            })
    except Exception as e:
        print(f"[{brand['name']}] HTML scrape error: {e}")
    return products


def scrape_brand(brand: dict) -> list:
    products = scrape_brand_shopify(brand)
    if not products:
        tqdm.write(f"  [{brand['name']}] Not Shopify, trying HTML...")
        products = scrape_brand_html(brand)
    return products


async def save_products(products: list):
    db = get_database()
    collection = db["brand_products"]

    if not products:
        return

    chunk_size = 500
    total_upserted = 0
    total_modified = 0

    for i in range(0, len(products), chunk_size):
        chunk = products[i:i + chunk_size]
        bulk = [
            UpdateOne(
                {"brand": p["brand"], "display_name": p["display_name"]},
                {"$set": p},
                upsert=True
            )
            for p in chunk
        ]
        result = await collection.bulk_write(bulk, ordered=False)
        total_upserted += result.upserted_count
        total_modified += result.modified_count

    print(f"  Saved: {total_upserted} new, {total_modified} updated")

async def main():
    await connect_db()

    total = 0
    for brand in tqdm(BRANDS, desc="Scraping brands"):
        tqdm.write(f"\n[{brand['name']}] Scraping...")
        products = scrape_brand(brand)
        tqdm.write(f"[{brand['name']}] Found {len(products)} products")
        await save_products(products)
        total += len(products)

    print(f"\nDone. Total: {total} products saved to brand_products collection.")
    await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())