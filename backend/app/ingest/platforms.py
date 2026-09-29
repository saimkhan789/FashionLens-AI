"""Catalogue readers for the kinds of stores brands run on.

Each reader is an async generator of ProductData batches. `detect_platform` picks
the right one: Shopify and WooCommerce expose full catalogues as JSON; anything
else (Salesforce Commerce, Magento, custom sites) falls back to reading the sitemap
and the schema.org Product data that stores embed in each product page for Google.
"""
import asyncio
import json
import re
from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from app.ingest.common import ProductData, to_decimal

GENERIC_MAX_PRODUCTS = 5000
GENERIC_CONCURRENCY = 6


def normalize_store_url(url: str) -> str:
    url = url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc.lower()}"


async def _json(client: httpx.AsyncClient, url: str, **params):
    try:
        r = await client.get(url, params=params)
        if r.status_code == 200 and "json" in r.headers.get("content-type", ""):
            return r.json()
    except (httpx.HTTPError, ValueError):
        pass
    return None


async def detect_platform(client: httpx.AsyncClient, base: str) -> str:
    data = await _json(client, f"{base}/products.json", limit=1)
    if isinstance(data, dict) and "products" in data:
        return "shopify"
    data = await _json(client, f"{base}/wp-json/wc/store/v1/products", per_page=1)
    if isinstance(data, list):
        return "woocommerce"
    return "generic"


# ---------------------------------------------------------------- Shopify

def _shopify_image(src: str) -> str:
    return "https:" + src if src.startswith("//") else src


async def read_shopify(client: httpx.AsyncClient, base: str) -> AsyncIterator[list[ProductData]]:
    page = 1
    while True:
        data = await _json(client, f"{base}/products.json", limit=250, page=page)
        items = (data or {}).get("products") or []
        if not items:
            return
        batch = []
        for p in items:
            images = p.get("images") or []
            if not images:
                continue
            variants = p.get("variants") or [{}]
            prices = [to_decimal(v.get("price")) for v in variants]
            prices = [x for x in prices if x]
            compare = to_decimal(variants[0].get("compare_at_price"))
            price = min(prices) if prices else None
            batch.append(ProductData(
                external_id=str(p["id"]),
                title=p.get("title") or "",
                image_url=_shopify_image(images[0]["src"]),
                product_url=f"{base}/products/{p['handle']}",
                price=price,
                compare_at_price=compare if compare and price and compare > price else None,
                product_type=p.get("product_type") or None,
                tags=p["tags"] if isinstance(p.get("tags"), list) else [t.strip() for t in (p.get("tags") or "").split(",") if t.strip()],
                available=any(v.get("available", True) for v in variants),
            ))
        yield batch
        if len(items) < 250:
            return
        page += 1
        await asyncio.sleep(0.5)  # be polite


# ---------------------------------------------------------------- WooCommerce

async def read_woocommerce(client: httpx.AsyncClient, base: str) -> AsyncIterator[list[ProductData]]:
    page = 1
    while True:
        items = await _json(client, f"{base}/wp-json/wc/store/v1/products", per_page=100, page=page)
        if not items:
            return
        batch = []
        for p in items:
            images = p.get("images") or []
            if not images:
                continue
            prices = p.get("prices") or {}
            unit = 10 ** int(prices.get("currency_minor_unit") or 0)
            price = to_decimal(prices.get("price"))
            regular = to_decimal(prices.get("regular_price"))
            price = price / unit if price else None
            regular = regular / unit if regular else None
            batch.append(ProductData(
                external_id=str(p["id"]),
                title=BeautifulSoup(p.get("name") or "", "html.parser").get_text(),
                image_url=images[0]["src"],
                product_url=p.get("permalink") or base,
                price=price,
                compare_at_price=regular if regular and price and regular > price else None,
                product_type=", ".join(c["name"] for c in p.get("categories") or []) or None,
                tags=[t["name"] for t in p.get("tags") or []],
                available=bool(p.get("is_in_stock", True)),
                currency=prices.get("currency_code"),
            ))
        yield batch
        if len(items) < 100:
            return
        page += 1
        await asyncio.sleep(0.5)


# ---------------------------------------------------------------- Generic (sitemap + JSON-LD)

async def _sitemap_urls(client: httpx.AsyncClient, base: str) -> list[str]:
    roots = []
    try:
        r = await client.get(f"{base}/robots.txt")
        if r.status_code == 200:
            roots = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", r.text)
    except httpx.HTTPError:
        pass
    roots = roots or [f"{base}/sitemap.xml", f"{base}/sitemap_index.xml"]

    pages, seen = [], set()
    queue = list(roots)
    while queue and len(seen) < 200:
        sm = queue.pop(0)
        if sm in seen:
            continue
        seen.add(sm)
        try:
            r = await client.get(sm)
        except httpx.HTTPError:
            continue
        if r.status_code != 200:
            continue
        soup = BeautifulSoup(r.content, "xml")
        if soup.find("sitemapindex"):
            children = [loc.get_text(strip=True) for loc in soup.select("sitemap > loc")]
            # Product sitemaps first; skip blog/category/image ones when they're labelled.
            product_maps = [c for c in children if "product" in c.lower()]
            queue.extend(product_maps or children)
        else:
            pages.extend(loc.get_text(strip=True) for loc in soup.select("url > loc"))
    return pages


def _find_product_ld(node):
    if isinstance(node, list):
        for n in node:
            if (found := _find_product_ld(n)) is not None:
                return found
    elif isinstance(node, dict):
        t = node.get("@type")
        if t == "Product" or (isinstance(t, list) and "Product" in t):
            return node
        for key in ("@graph", "mainEntity", "itemListElement"):
            if key in node and (found := _find_product_ld(node[key])) is not None:
                return found
    return None


def _first(value):
    return value[0] if isinstance(value, list) and value else value


def parse_product_page(html: str, url: str) -> ProductData | None:
    soup = BeautifulSoup(html, "html.parser")
    ld = None
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            ld = _find_product_ld(json.loads(tag.string or ""))
        except (json.JSONDecodeError, TypeError):
            continue
        if ld:
            break

    def meta(prop: str) -> str | None:
        el = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        return el.get("content") if el else None

    if ld:
        offers = _first(ld.get("offers")) or {}
        if isinstance(offers, dict) and offers.get("@type") == "AggregateOffer":
            price = to_decimal(offers.get("lowPrice"))
        else:
            price = to_decimal(offers.get("price") if isinstance(offers, dict) else None)
        image = _first(ld.get("image"))
        if isinstance(image, dict):
            image = image.get("url") or image.get("contentUrl")
        availability = str(offers.get("availability", "")) if isinstance(offers, dict) else ""
        title = ld.get("name")
        return ProductData(
            external_id=str(ld.get("sku") or ld.get("productID") or url),
            title=title or meta("og:title") or "",
            image_url=urljoin(url, image or meta("og:image") or ""),
            product_url=url,
            price=price,
            product_type=_first(ld.get("category")) if isinstance(_first(ld.get("category")), str) else None,
            available="OutOfStock" not in availability,
            currency=offers.get("priceCurrency") if isinstance(offers, dict) else None,
        )

    # No structured data — accept OpenGraph product pages only.
    if meta("og:type") == "product" and meta("og:image"):
        return ProductData(
            external_id=url,
            title=meta("og:title") or "",
            image_url=urljoin(url, meta("og:image")),
            product_url=url,
            price=to_decimal(meta("product:price:amount") or meta("og:price:amount")),
            currency=meta("product:price:currency"),
        )
    return None


async def read_generic(client: httpx.AsyncClient, base: str, max_products: int = GENERIC_MAX_PRODUCTS) -> AsyncIterator[list[ProductData]]:
    urls = await _sitemap_urls(client, base)
    host = urlsplit(base).netloc
    urls = [u for u in dict.fromkeys(urls) if urlsplit(u).netloc == host]
    # Stores often put product and category pages in one sitemap; product-looking URLs first.
    urls.sort(key=lambda u: 0 if re.search(r"/(products?|p)/|\.html$|\d{5,}", u) else 1)
    urls = urls[: max_products * 2]
    if not urls:
        raise RuntimeError("No sitemap found — can't list this store's products")

    sem = asyncio.Semaphore(GENERIC_CONCURRENCY)

    async def fetch(u: str) -> ProductData | None:
        async with sem:
            try:
                r = await client.get(u)
            except httpx.HTTPError:
                return None
            if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
                return None
            p = parse_product_page(r.text, str(r.url))
            return p if p and p.title and p.image_url else None

    found, misses = 0, 0
    for i in range(0, len(urls), 50):
        batch = [p for p in await asyncio.gather(*(fetch(u) for u in urls[i:i + 50])) if p]
        found += len(batch)
        misses = 0 if batch else misses + 1
        if batch:
            yield batch
        # Past the product section of the sitemap (blog posts, categories...) — stop.
        if found >= max_products or (found and misses >= 4) or (not found and i >= 300):
            return


READERS = {"shopify": read_shopify, "woocommerce": read_woocommerce, "generic": read_generic}
