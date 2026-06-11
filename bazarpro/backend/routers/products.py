from fastapi import APIRouter, Depends, Query
from auth import current_user
from dolibarr import get_products, get_categories, get_product_by_ref

router = APIRouter(prefix="/products", tags=["products"])

_cache: dict = {"products": [], "categories": [], "ts": 0.0}
import time
CACHE_TTL = 180


def _norm(p: dict) -> dict:
    price = float(p.get("price") or p.get("price_ttc") or 0)
    cost  = float(p.get("cost_price") or p.get("pmp") or 0)
    stock = float(p.get("stock_reel") or 0)
    cats  = p.get("categories") or []
    cat_id   = cats[0].get("id", 0) if cats else 0
    cat_name = cats[0].get("label", "") if cats else ""
    return {
        "id":           int(p.get("id") or p.get("rowid", 0)),
        "ref":          p.get("ref", ""),
        "label":        p.get("label", ""),
        "price":        price,
        "cost_price":   cost,
        "stock":        stock,
        "unit":         p.get("unit_label") or p.get("fk_unit") or "шт",
        "category_id":  cat_id,
        "category_name": cat_name,
        "barcode":      p.get("barcode") or "",
        "description":  (p.get("description") or "").strip()[:200],
    }


async def _get_cached():
    global _cache
    if time.time() - _cache["ts"] < CACHE_TTL:
        return _cache["products"], _cache["categories"]
    try:
        prods = await get_products(limit=1000)
        cats  = await get_categories()
        if isinstance(prods, list):
            _cache["products"] = [_norm(p) for p in prods]
        if isinstance(cats, list):
            _cache["categories"] = cats
        _cache["ts"] = time.time()
    except Exception as e:
        pass
    return _cache["products"], _cache["categories"]


@router.get("")
async def list_products(
    search: str = Query(""),
    category_id: int = Query(0),
    _: dict = Depends(current_user),
):
    prods, _ = await _get_cached()
    if search:
        q = search.lower()
        prods = [p for p in prods if q in p["label"].lower() or q in p["ref"].lower()]
    if category_id:
        prods = [p for p in prods if p["category_id"] == category_id]
    return prods[:100]


@router.get("/categories")
async def list_categories(_: dict = Depends(current_user)):
    _, cats = await _get_cached()
    return [{"id": int(c.get("id") or c.get("rowid", 0)), "label": c.get("label", "")} for c in cats]


@router.get("/barcode/{barcode}")
async def by_barcode(barcode: str, _: dict = Depends(current_user)):
    prods, _ = await _get_cached()
    p = next((p for p in prods if p.get("barcode") == barcode), None)
    return p or {}


@router.post("/cache/refresh")
async def refresh_cache(_: dict = Depends(current_user)):
    _cache["ts"] = 0.0
    await _get_cached()
    return {"count": len(_cache["products"])}
