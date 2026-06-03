#!/usr/bin/env python3
"""Sync SR Lux catalog → Bollente Dolibarr."""

import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

for _env in [Path("/home/ubuntu/.env"), Path(__file__).parent / ".env"]:
    if _env.exists():
        load_dotenv(_env, override=False)

SRLUX_API = os.getenv("SRLUX_API_URL", "https://srlux.uz")
DOL_URL   = os.getenv("BOLLENTE_DOLIBARR_URL", "").rstrip("/")
DOL_KEY   = os.getenv("BOLLENTE_DOLIBARR_KEY", "")

logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)
log = logging.getLogger("srlux_sync")

HEADERS = {"DOLAPIKEY": DOL_KEY, "Content-Type": "application/json"}


def dol(method: str, path: str, **kw):
    url = f"{DOL_URL}/api/index.php/{path}"
    r = httpx.request(method, url, headers=HEADERS, timeout=30, verify=False, **kw)
    r.raise_for_status()
    return r.json()


def fetch_all_products() -> list:
    products, page = [], 1
    while True:
        data = httpx.get(f"{SRLUX_API}/api/products", params={"page": page, "limit": 100}, timeout=30).json()
        items = data.get("products") or []
        products.extend(items)
        if len(products) >= int(data.get("total") or 0) or len(items) < 100:
            break
        page += 1
    return products


def fetch_categories() -> list:
    data = httpx.get(f"{SRLUX_API}/api/categories", timeout=30).json()
    return data if isinstance(data, list) else data.get("categories", [])


def sync_categories(cats: list) -> dict:
    """Returns {srlux_cat_id: dolibarr_cat_id}."""
    mapping = {}
    existing = dol("GET", "categories", params={"type": "product", "limit": 200})
    existing_by_label = {c["label"]: int(c.get("id") or c.get("rowid", 0))
                         for c in (existing if isinstance(existing, list) else [])}

    for cat in cats:
        name = cat.get("name_ru") or cat.get("name_uz") or ""
        if not name:
            continue
        if name in existing_by_label:
            mapping[cat["id"]] = existing_by_label[name]
        else:
            try:
                new_id = dol("POST", "categories", json={"label": name, "type": "product"})
                mapping[cat["id"]] = int(new_id)
                log.info(f"+ category: {name}")
            except Exception as e:
                log.warning(f"Category '{name}' failed: {e}")

    log.info(f"Categories: {len(mapping)} synced")
    return mapping


def sync_products(products: list, cat_map: dict):
    created = updated = skipped = 0

    for p in products:
        ref   = (p.get("sku") or p.get("slug") or "").strip()
        name  = p.get("name_ru") or p.get("name_uz") or ""
        price = float(p.get("price_uzs") or 0)
        stock = int(p.get("stock") or 0)
        desc  = (p.get("description_ru") or p.get("description_uz") or "").strip()
        cat   = p.get("category") or {}
        cat_id = cat_map.get(cat.get("id", 0), 0)

        if not ref or not name:
            skipped += 1
            continue

        payload = {
            "ref":         ref,
            "label":       name,
            "price":       price,
            "type":        0,
            "status":      1,
            "description": desc,
        }

        try:
            found = dol("GET", "products", params={"sqlfilters": f"(ref:=:'{ref}')", "limit": 1})
            if isinstance(found, list) and found:
                pid = found[0].get("id") or found[0].get("rowid")
                dol("PUT", f"products/{pid}", json=payload)
                updated += 1
            else:
                pid = dol("POST", "products", json=payload)
                pid = int(pid)
                # Assign category
                if cat_id and pid:
                    try:
                        dol("POST", f"categories/{cat_id}/objects", json={"id": pid, "type": "product"})
                    except Exception:
                        pass
                created += 1
        except Exception as e:
            log.warning(f"Product '{ref}' failed: {e}")
            skipped += 1

    log.info(f"Products: {created} created, {updated} updated, {skipped} skipped")


def main():
    if not DOL_URL or not DOL_KEY:
        log.error("BOLLENTE_DOLIBARR_URL or BOLLENTE_DOLIBARR_KEY not set")
        return

    log.info("=== SR Lux → Bollente Dolibarr sync started ===")

    cats = fetch_categories()
    log.info(f"Fetched {len(cats)} categories from SR Lux")
    cat_map = sync_categories(cats)

    products = fetch_all_products()
    log.info(f"Fetched {len(products)} products from SR Lux")
    sync_products(products, cat_map)

    log.info("=== Sync completed ===")


if __name__ == "__main__":
    main()
