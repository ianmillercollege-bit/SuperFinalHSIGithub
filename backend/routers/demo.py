"""Website demo: a Claude conversation using the CIRQO plugin, for embedding in any site.

  GET  /demo                 the chat page itself; embed it with <iframe src="https://<backend>/demo">
  POST /api/v1/demo/chat     {"messages": [{"role": "user"|"assistant", "text": "..."}]}
                             -> {"reply", "toolCalls", "mode": "live"|"scripted", "note"?}

Same small in-memory rate limit as the AI Coach, since live mode spends on the Anthropic key.
"""

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from errors import error_response
from routers.coach import _caller, limited
from services import demo_chat

STATIC = Path(__file__).resolve().parents[1] / "static"
PAGE = STATIC / "demo.html"

router = APIRouter(tags=["Demo"])
page_router = APIRouter(tags=["Demo"])


class DemoTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=4000)


class DemoChatIn(BaseModel):
    messages: list[DemoTurn] = Field(min_length=1, max_length=20)

    @field_validator("messages")
    @classmethod
    def ends_with_user(cls, value: list[DemoTurn]) -> list[DemoTurn]:
        if value[-1].role != "user" or not value[-1].text.strip():
            raise ValueError("the last message must be a non-blank user message")
        if value[0].role != "user":
            raise ValueError("the first message must be a user message")
        return value


@router.post("/demo/chat")
async def demo_chat_turn(body: DemoChatIn, request: Request):
    if limited(_caller(request)):
        return error_response(429, "RATE_LIMITED", "Too many demo messages. Try again in a minute.")
    return await demo_chat.answer([t.model_dump() for t in body.messages])


@page_router.get("/demo", include_in_schema=False)
def demo_page() -> FileResponse:
    # No X-Frame-Options on purpose: this page exists to be framed by other sites.
    return FileResponse(PAGE, media_type="text/html")


@page_router.get("/demo/cirqo-mark.png", include_in_schema=False)
def demo_mark() -> FileResponse:
    return FileResponse(STATIC / "cirqo-mark.png", media_type="image/png")
