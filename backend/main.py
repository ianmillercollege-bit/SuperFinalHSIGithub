"""CIRQO API. Run locally from backend/: uvicorn main:app --reload"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from errors import register_error_handlers
from mcp_http import MCP_PATH, mcp_asgi, start as start_mcp
from routers import auth, brands, client, coach, community, connector, dashboard, governance, shopper
from schemas import HealthResponse
from seed_loader import rebuild_database
from services.community import connector_gate
from settings import settings

VERSION = "0.1.0"

# The database is rebuilt from seed data on every startup (BACKEND_CONTRACT.md section 3).
rebuild_database()

# BACKEND_CONTRACT.md section 3: localhost:3000, every *.vercel.app (production and previews),
# plus anything listed in FRONTEND_ORIGINS.
ALLOWED_ORIGINS = ["http://localhost:3000", *settings.frontend_origin_list]
ALLOWED_ORIGIN_REGEX = r"https://.*\.vercel\.app"

# DECISIONS.md #18: user-facing name is CIRQO. Paths, field names, demo keys and env vars are unchanged.


@asynccontextmanager
async def lifespan(_: FastAPI):
    # The remote MCP endpoint (/mcp) needs its session manager running for the life of the app.
    async with start_mcp():
        yield


app = FastAPI(title="CIRQO API", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

# Everything except /health lives under /api/v1 (BACKEND_CONTRACT.md section 1).
# v1.6: connector calls see refurbished and surplus products only with constraints.includeRefurbished.
# v1.8: the AI Coach (section 7f) is the second AI-backed endpoint; MOCK_MODE keeps it AI-free.
for module in (shopper, connector, dashboard, governance, client, auth, brands, community, coach):
    gates = [Depends(connector_gate)] if module is connector else []
    app.include_router(module.router, prefix="/api/v1", dependencies=gates)


# Remote MCP connector: POST https://<backend>/mcp (BACKEND_CONTRACT.md section 7 Connector, v1.7).
app.add_route(MCP_PATH, mcp_asgi, methods=["GET", "POST", "DELETE"])


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", mock_mode=settings.mock_mode, version=VERSION)
