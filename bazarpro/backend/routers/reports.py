from datetime import datetime, date
from fastapi import APIRouter, Depends, Query
from auth import require_role
from pathlib import Path
import json

router = APIRouter(prefix="/reports", tags=["reports"])
ORDERS_FILE = Path(__file__).parent.parent / "orders.json"


def _load() -> list:
    if not ORDERS_FILE.exists():
        return []
    return json.loads(ORDERS_FILE.read_text())


@router.get("/summary")
async def daily_summary(
    day: str = Query(default=""),
    store_id: int = Query(default=0),
    _: dict = Depends(require_role("owner", "seller")),
):
    target = day or date.today().isoformat()
    orders = [
        o for o in _load()
        if o.get("created_at", "").startswith(target)
        and o.get("status") not in ("cancelled",)
        and (not store_id or o.get("store_id") == store_id)
    ]
    revenue     = sum(o.get("total", 0) for o in orders)
    paid        = sum(o.get("paid", 0) for o in orders)
    cash        = sum(o.get("payment_cash", 0) for o in orders)
    card        = sum(o.get("payment_card", 0) for o in orders)
    transfer    = sum(o.get("payment_transfer", 0) for o in orders)
    count       = len(orders)

    by_seller: dict = {}
    for o in orders:
        s = o.get("seller_name", "—")
        by_seller.setdefault(s, {"count": 0, "total": 0})
        by_seller[s]["count"] += 1
        by_seller[s]["total"] += o.get("total", 0)

    return {
        "date":      target,
        "count":     count,
        "revenue":   round(revenue, 2),
        "paid":      round(paid, 2),
        "debt":      round(revenue - paid, 2),
        "cash":      round(cash, 2),
        "card":      round(card, 2),
        "transfer":  round(transfer, 2),
        "by_seller": by_seller,
    }


@router.get("/top-products")
async def top_products(
    days: int = Query(default=30),
    store_id: int = Query(default=0),
    _: dict = Depends(require_role("owner")),
):
    orders = _load()
    counts: dict = {}
    for o in orders:
        if store_id and o.get("store_id") != store_id:
            continue
        for item in o.get("items", []):
            ref = item.get("ref", "")
            counts.setdefault(ref, {"ref": ref, "label": item.get("label", ""), "qty": 0, "revenue": 0})
            counts[ref]["qty"]     += item.get("qty", 0)
            counts[ref]["revenue"] += item.get("qty", 0) * item.get("price", 0) * (1 - item.get("discount_pct", 0) / 100)

    top = sorted(counts.values(), key=lambda x: x["revenue"], reverse=True)[:20]
    return top


@router.get("/debts")
async def debts(
    store_id: int = Query(default=0),
    _: dict = Depends(require_role("owner", "seller")),
):
    orders = [
        o for o in _load()
        if o.get("status") not in ("paid", "cancelled")
        and o.get("total", 0) > o.get("paid", 0)
        and (not store_id or o.get("store_id") == store_id)
    ]
    return [
        {
            "order_ref":     o["ref"],
            "customer_name": o.get("customer_name", "—"),
            "customer_phone": o.get("customer_phone", ""),
            "total":         o.get("total", 0),
            "paid":          o.get("paid", 0),
            "debt":          round(o.get("total", 0) - o.get("paid", 0), 2),
            "created_at":    o.get("created_at", ""),
        }
        for o in orders
    ]
