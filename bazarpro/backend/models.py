from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    store_id: int


class User(BaseModel):
    id: int
    username: str
    role: str  # owner | seller | assembler
    name: str
    store_id: int


class Product(BaseModel):
    id: int
    ref: str
    label: str
    price: float
    cost_price: float
    stock: float
    unit: str
    category_id: int
    category_name: str
    barcode: Optional[str] = None


class CartItem(BaseModel):
    product_id: int
    ref: str
    label: str
    qty: float
    unit: str
    price: float
    cost_price: float
    discount_pct: float = 0.0


class QuickSaleRequest(BaseModel):
    items: list[CartItem]
    payment_cash: float = 0.0
    payment_card: float = 0.0
    payment_transfer: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    seller_id: int
    store_id: int
    note: Optional[str] = None


class ProjectSaleRequest(BaseModel):
    items: list[CartItem]
    customer_name: str
    customer_phone: str
    object_name: str
    master_name: str
    advance_amount: float = 0.0
    seller_id: int
    store_id: int
    note: Optional[str] = None


class OrderItem(BaseModel):
    product_id: int
    ref: str
    label: str
    qty: float
    qty_picked: float = 0.0
    unit: str
    price: float
    cost_price: float
    discount_pct: float
    status: str = "pending"  # pending | picked | substituted | unavailable
    substitute_ref: Optional[str] = None
    substitute_label: Optional[str] = None


class Order(BaseModel):
    id: int
    ref: str
    type: str  # quick | project
    status: str  # draft | confirmed | picking | shipped | invoiced | paid | cancelled
    customer_name: Optional[str]
    customer_phone: Optional[str]
    object_name: Optional[str]
    master_name: Optional[str]
    items: list[OrderItem]
    total: float
    discount_total: float
    paid: float
    store_id: int
    seller_id: int
    created_at: str
