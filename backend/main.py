"""FrontDoor API. Run locally from backend/: uvicorn main:app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from errors import register_error_handlers
from schemas import HealthResponse
from settings import settings

VERSION = "0.1.0"

# BACKEND_CONTRACT.md section 3: localhost:3000, every *.vercel.app (production and previews),
# plus anything listed in FRONTEND_ORIGINS.
ALLOWED_ORIGINS = ["http://localhost:3000", *settings.frontend_origin_list]
ALLOWED_ORIGIN_REGEX = r"https://.*\.vercel\.app"

app = FastAPI(title="FrontDoor API", version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", mock_mode=settings.mock_mode, version=VERSION)
