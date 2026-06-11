import httpx
from config import DOLIBARR_URL, DOLIBARR_KEY

_headers = lambda: {"DOLAPIKEY": DOLIBARR_KEY, "Content-Type": "application/json"}


async def dol_get(path: str, params: dict = None) -> list | dict:
    async with httpx.AsyncClient(timeout=15, verify=False) as c:
        r = await c.get(
            f"{DOLIBARR_URL}/api/index.php/{path}",
            headers=_headers(),
            params=params or {},
        )
        r.raise_for_status()
        return r.json()


async def dol_post(path: str, data: dict) -> dict:
    async with httpx.AsyncClient(timeout=15, verify=False) as c:
        r = await c.post(
            f"{DOLIBARR_URL}/api/index.php/{path}",
            headers=_headers(),
            json=data,
        )
        r.raise_for_status()
        return r.json()


async def dol_put(path: str, data: dict) -> dict:
    async with httpx.AsyncClient(timeout=15, verify=False) as c:
        r = await c.put(
            f"{DOLIBARR_URL}/api/index.php/{path}",
            headers=_headers(),
            json=data,
        )
        r.raise_for_status()
        return r.json()


async def get_products(limit: int = 500, category_id: int = None) -> list:
    params = {"limit": limit, "sortfield": "label", "sortorder": "ASC", "mode": 1}
    if category_id:
        params["category"] = category_id
    return await dol_get("products", params)


async def get_product_by_ref(ref: str) -> dict | None:
    result = await dol_get("products", {"sqlfilters": f"(ref:=:'{ref}')", "limit": 1})
    return result[0] if isinstance(result, list) and result else None


async def get_categories() -> list:
    return await dol_get("categories", {"type": "product", "limit": 100})


async def get_customers(limit: int = 100, search: str = None) -> list:
    params = {"limit": limit, "sortfield": "nom", "sortorder": "ASC", "mode": 2}
    if search:
        params["sqlfilters"] = f"(nom:like:'%{search}%')"
    return await dol_get("thirdparties", params)


async def create_customer(name: str, phone: str = None) -> int:
    data = {"name": name, "client": 1, "status": 1}
    if phone:
        data["phone"] = phone
    result = await dol_post("thirdparties", data)
    return int(result)


async def create_order(data: dict) -> int:
    result = await dol_post("orders", data)
    return int(result)


async def get_orders(status: str = None, limit: int = 50) -> list:
    params = {"limit": limit, "sortfield": "date_commande", "sortorder": "DESC"}
    if status is not None:
        params["sqlfilters"] = f"(fk_statut:=:{status})"
    return await dol_get("orders", params)


async def get_order(order_id: int) -> dict:
    return await dol_get(f"orders/{order_id}")


async def create_invoice(data: dict) -> int:
    result = await dol_post("invoices", data)
    return int(result)


async def add_payment(invoice_id: int, amount: float, payment_mode: str, date: str) -> dict:
    return await dol_post(f"invoices/{invoice_id}/payments", {
        "datepaye": date,
        "amount": amount,
        "paiementid": payment_mode,
    })
