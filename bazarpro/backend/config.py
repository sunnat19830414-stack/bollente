import os
from pathlib import Path
from dotenv import load_dotenv

for _env in [Path("/home/ubuntu/.env"), Path(__file__).parent / ".env"]:
    if _env.exists():
        load_dotenv(_env, override=True)

DOLIBARR_URL = os.getenv("DOLIBARR_URL", "http://localhost").rstrip("/")
DOLIBARR_KEY = os.getenv("DOLIBARR_KEY", "")
JWT_SECRET   = os.getenv("JWT_SECRET", "bazarpro-secret-change-me")
JWT_EXPIRE   = int(os.getenv("JWT_EXPIRE_HOURS", "12"))
PORT         = int(os.getenv("BAZARPRO_PORT", "8000"))
