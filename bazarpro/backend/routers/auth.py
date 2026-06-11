import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from models import LoginRequest, Token
from auth import get_user, verify_password, create_token, current_user, hash_password, require_role

router = APIRouter(prefix="/auth", tags=["auth"])
USERS_FILE = Path(__file__).parent.parent / "users.json"


@router.post("/login", response_model=Token)
def login(req: LoginRequest):
    user = get_user(req.username)
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    if not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Неверный пароль")
    return Token(
        access_token=create_token(user),
        role=user["role"],
        name=user["name"],
        store_id=user["store_id"],
    )


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return {k: user[k] for k in ("sub", "username", "role", "name", "store_id")}


@router.get("/users")
def list_users(user: dict = Depends(require_role("owner"))):
    users = json.loads(USERS_FILE.read_text()) if USERS_FILE.exists() else []
    return [{"id": u["id"], "username": u["username"], "role": u["role"],
             "name": u["name"], "store_id": u["store_id"], "active": u.get("active", True)}
            for u in users]


@router.post("/users/{user_id}/toggle")
def toggle_user(user_id: int, _: dict = Depends(require_role("owner"))):
    users = json.loads(USERS_FILE.read_text())
    for u in users:
        if u["id"] == user_id:
            u["active"] = not u.get("active", True)
            USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2))
            return {"active": u["active"]}
    raise HTTPException(404, "Пользователь не найден")


@router.post("/users/{user_id}/password")
def change_password(user_id: int, body: dict, _: dict = Depends(require_role("owner"))):
    users = json.loads(USERS_FILE.read_text())
    for u in users:
        if u["id"] == user_id:
            u["password"] = hash_password(body["password"])
            USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2))
            return {"ok": True}
    raise HTTPException(404, "Пользователь не найден")
