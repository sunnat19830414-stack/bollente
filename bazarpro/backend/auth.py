import json
from pathlib import Path
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import JWT_SECRET, JWT_EXPIRE

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()

USERS_FILE = Path(__file__).parent / "users.json"


def _load_users() -> list:
    if not USERS_FILE.exists():
        return []
    return json.loads(USERS_FILE.read_text())


def _save_users(users: list):
    USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2))


def get_user(username: str) -> dict | None:
    return next((u for u in _load_users() if u["username"] == username), None)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd.hash(plain)


def create_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "name": user["name"],
        "store_id": user["store_id"],
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    return decode_token(creds.credentials)


def require_role(*roles: str):
    def checker(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Нет доступа")
        return user
    return checker


def init_default_users():
    if USERS_FILE.exists():
        return
    users = [
        {"id": 1, "username": "owner",      "password": hash_password("owner123"),     "role": "owner",     "name": "Владелец",   "store_id": 1, "active": True},
        {"id": 2, "username": "seller1",    "password": hash_password("seller123"),    "role": "seller",    "name": "Продавец 1", "store_id": 1, "active": True},
        {"id": 3, "username": "seller2",    "password": hash_password("seller123"),    "role": "seller",    "name": "Продавец 2", "store_id": 1, "active": True},
        {"id": 4, "username": "assembler1", "password": hash_password("assembler123"), "role": "assembler", "name": "Сборщик 1",  "store_id": 1, "active": True},
        {"id": 5, "username": "assembler2", "password": hash_password("assembler123"), "role": "assembler", "name": "Сборщик 2",  "store_id": 1, "active": True},
    ]
    _save_users(users)
