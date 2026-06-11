from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from auth import init_default_users
from routers import auth, products, orders, reports

app = FastAPI(title="BazarPro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(orders.router,   prefix="/api")
app.include_router(reports.router,  prefix="/api")


@app.on_event("startup")
def startup():
    init_default_users()


@app.get("/health")
def health():
    return {"status": "ok", "app": "BazarPro"}


# Serve frontend if built
frontend = Path(__file__).parent.parent / "frontend" / "dist"
if frontend.exists():
    app.mount("/", StaticFiles(directory=str(frontend), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    from config import PORT
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
