"""AI Coach endpoint (BACKEND_CONTRACT.md section 7f): POST /api/v1/coach.

The frontend sends the question, the last chat turns and the dashboard figures; the reply comes back
from services/coach.py with "source": "live" | "mock" | "fallback" and "verified" set by plain code.
A small in-memory rate limit (per caller per minute, plus a daily total) protects the AI spend on a
single-instance demo server. Real spend control is the limit set in the Anthropic console.
"""

import time
from collections import defaultdict

from fastapi import APIRouter, Request

from errors import error_response
from schemas import CoachReplyOut, CoachRequestIn
from services import coach
from settings import settings

router = APIRouter(tags=["Coach"])

_recent: dict[str, list[float]] = defaultdict(list)
_day = {"key": "", "count": 0}


def reset_limits() -> None:
    _recent.clear()
    _day.update(key="", count=0)


def _caller(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "local"


def limited(caller: str) -> bool:
    now = time.time()
    today = time.strftime("%Y-%m-%d", time.gmtime(now))
    if _day["key"] != today:
        _day.update(key=today, count=0)
    recent = [t for t in _recent[caller] if now - t < 60]
    if len(recent) >= settings.coach_rate_per_min or _day["count"] >= settings.coach_daily_cap:
        _recent[caller] = recent
        return True
    recent.append(now)
    _recent[caller] = recent
    _day["count"] += 1
    return False


@router.post("/coach", response_model=CoachReplyOut, response_model_exclude_none=True)
def ask_coach(body: CoachRequestIn, request: Request):
    if limited(_caller(request)):
        return error_response(429, "RATE_LIMITED", "Too many coach requests. Try again in a minute.")
    history = [t.model_dump() for t in body.history]
    return coach.answer(body.question, history, body.context)
