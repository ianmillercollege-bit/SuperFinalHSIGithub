"""CIRQO API. Run locally from backend/: uvicorn main:app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from errors import register_error_handlers
from routers import client, dashboard, governance, shopper
from schemas import HealthResponse
from seed_loader import rebuild_database
from settings import settings

VERSION = "0.1.0"

# The database is rebuilt from seed data on every startup (BACKEND_CONTRACT.md section 3).
rebuild_database()

# BACKEND_CONTRACT.md section 3: localhost:3000, every *.vercel.app (production and previews),
# plus anything listed in FRONTEND_ORIGINS.
ALLOWED_ORIGINS = ["http://localhost:3000", *settings.frontend_origin_list]
ALLOWED_ORIGIN_REGEX = r"https://.*\.vercel\.app"

# DECISIONS.md #18: user-facing name is CIRQO. Paths, field names, demo keys and env vars are unchanged.
app = FastAPI(title="CIRQO API", version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

# Everything except /health lives under /api/v1 (BACKEND_CONTRACT.md section 1).
for module in (shopper, dashboard, governance, client):
    app.include_router(module.router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", mock_mode=settings.mock_mode, version=VERSION)
