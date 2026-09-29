"""FrontDoor API. Run locally from backend/: uvicorn main:app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from errors import register_error_handlers
from settings import settings

# DECISIONS.md #4. The Vercel URL is a placeholder until the first frontend deploy;
# the regex below already covers it and every *.vercel.app preview.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://frontdoor-SCHOOL.vercel.app",
]
ALLOWED_ORIGIN_REGEX = r"https://[a-zA-Z0-9-]+\.vercel\.app"

app = FastAPI(title="FrontDoor API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mock_mode": settings.mock_mode}
