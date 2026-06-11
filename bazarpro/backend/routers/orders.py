import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user, require_role
from models import QuickSaleRequest, ProjectSaleRequest
from dolibarr import get_orders, get_order, create_order

router = APIRouter(prefix="/orders", tags=["orders"])

ORDERS_FILE = Path(__file__).parent.parent / "orders.json"


def _load() -> list:
    if not ORDERS_FILE.exists():
        return []
    return json.loads(ORDERS_FILE.read_text())


def _save(orders: list):
    ORDERS_FILE.write_text(json.dumps(orders, ensure_ascii=False, indent=2))


def _next_id(orders: list) -> int:
    return max((o["id"] for o in orders), default=0) + 1


def _next_ref(orders: list, prefix: str = "BP") -> str:
    n = max((o.get("number", 0) for o in orders), default=0) + 1
    return f"{prefix}-{n:04d}", n


@router.post("/quick")
async def quick_sale(req: QuickSaleRequest, user: dict = Depends(current_user)):
    orders = _load()
    ref, num = _next_ref(orders, "BP")
    total = sum(i.qty * i.price * (1 - i.discount_pct / 100) for i in req.items)

    # Warn if any item sold below cost
    warnings = []
    for item in req.items:
        sale_price = item.price * (1 - item.discount_pct / 100)
        if item.cost_price > 0 and sale_price < item.cost_price:
            warnings.append(f"{item.label}: цена {sale_price:.0f} ниже себестоимости {item.cost_price:.0f}")

    order = {
        "id":             _next_id(orders),
        "ref":            ref,
        "number":         num,
        "type":           "quick",
        "status":         "paid",
        "customer_name":  req.customer_name or "Розничный покупатель",
        "customer_phone": req.customer_phone or "",
        "object_name":    "",
        "master_name":    "",
        "items":          [i.model_dump() for i in req.items],
        "total":          round(total, 2),
        "paid":           req.payment_cash + req.payment_card + req.payment_transfer,
        "payment_cash":   req.payment_cash,
        "payment_card":   req.payment_card,
        "payment_transfer": req.payment_transfer,
        "seller_id":      req.seller_id,
        "seller_name":    user.get("name", ""),
        "store_id":       req.store_id,
        "note":           req.note or "",
        "created_at":     datetime.now().isoformat(),
        "log":            [{"action": "created", "user": user.get("name"), "at": datetime.now().isoformat()}],
    }
    orders.insert(0, order)
    _save(orders)
    return {"order": order, "warnings": warnings}


@router.post("/project")
async def project_sale(req: ProjectSaleRequest, user: dict = Depends(current_user)):
    orders = _load()
    ref, num = _next_ref(orders, "PROJ")
    total = sum(i.qty * i.price * (1 - i.discount_pct / 100) for i in req.items)

    warnings = []
    for item in req.items:
        sale_price = item.price * (1 - item.discount_pct / 100)
        if item.cost_price > 0 and sale_price < item.cost_price:
            warnings.append(f"{item.label}: цена {sale_price:.0f} ниже себестоимости {item.cost_price:.0f}")

    items = [{**i.model_dump(), "status": "pending", "qty_picked": 0} for i in req.items]

    order = {
        "id":             _next_id(orders),
        "ref":            ref,
        "number":         num,
        "type":           "project",
        "status":         "confirmed",
        "customer_name":  req.customer_name,
        "customer_phone": req.customer_phone,
        "object_name":    req.object_name,
        "master_name":    req.master_name,
        "items":          items,
        "total":          round(total, 2),
        "advance":        req.advance_amount,
        "paid":           req.advance_amount,
        "payment_cash":   0,
        "payment_card":   0,
        "payment_transfer": 0,
        "seller_id":      req.seller_id,
        "seller_name":    user.get("name", ""),
        "store_id":       req.store_id,
        "note":           req.note or "",
        "created_at":     datetime.now().isoformat(),
        "log":            [{"action": "created", "user": user.get("name"), "at": datetime.now().isoformat()}],
    }
    orders.insert(0, order)
    _save(orders)
    return {"order": order, "warnings": warnings}


@router.get("")
async def list_orders(
    status: str = "",
    type: str = "",
    store_id: int = 0,
    _: dict = Depends(current_user),
):
    orders = _load()
    if status:
        orders = [o for o in orders if o.get("status") == status]
    if type:
        orders = [o for o in orders if o.get("type") == type]
    if store_id:
        orders = [o for o in orders if o.get("store_id") == store_id]
    return orders[:100]


@router.get("/{order_id}")
async def get_order_by_id(order_id: int, _: dict = Depends(current_user)):
    order = next((o for o in _load() if o["id"] == order_id), None)
    if not order:
        raise HTTPException(404, "Заказ не найден")
    return order


@router.patch("/{order_id}/item/{item_idx}/substitute")
async def substitute_item(order_id: int, item_idx: int, body: dict, user: dict = Depends(require_role("assembler", "seller", "owner"))):
    orders = _load()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        raise HTTPException(404, "Заказ не найден")
    if item_idx >= len(order["items"]):
        raise HTTPException(400, "Неверный индекс товара")

    item = order["items"][item_idx]
    item["status"]           = "substituted"
    item["substitute_ref"]   = body.get("substitute_ref", "")
    item["substitute_label"] = body.get("substitute_label", "")
    item["substitute_price"] = body.get("substitute_price", 0)

    order["log"].append({
        "action": f"substituted item {item['ref']} → {item['substitute_ref']}",
        "user":   user.get("name"),
        "at":     datetime.now().isoformat(),
    })
    _save(orders)
    return order


@router.patch("/{order_id}/ship")
async def ship_order(order_id: int, user: dict = Depends(require_role("assembler", "seller", "owner"))):
    orders = _load()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        raise HTTPException(404, "Заказ не найден")
    order["status"] = "shipped"
    order["log"].append({"action": "shipped", "user": user.get("name"), "at": datetime.now().isoformat()})
    _save(orders)
    return order


@router.patch("/{order_id}/pay")
async def pay_order(order_id: int, body: dict, user: dict = Depends(require_role("seller", "owner"))):
    orders = _load()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        raise HTTPException(404, "Заказ не найден")

    order["payment_cash"]     = order.get("payment_cash", 0) + body.get("cash", 0)
    order["payment_card"]     = order.get("payment_card", 0) + body.get("card", 0)
    order["payment_transfer"] = order.get("payment_transfer", 0) + body.get("transfer", 0)
    order["paid"] = order["payment_cash"] + order["payment_card"] + order["payment_transfer"]

    if body.get("discount_extra"):
        order["discount_extra"] = body["discount_extra"]
        order["total"] = order["total"] * (1 - body["discount_extra"] / 100)

    if order["paid"] >= order["total"]:
        order["status"] = "paid"

    order["log"].append({"action": f"payment {order['paid']}", "user": user.get("name"), "at": datetime.now().isoformat()})
    _save(orders)
    return order
