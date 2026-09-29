"""CIRQO as an MCP server (stdio).

Lets an MCP client such as Claude Desktop call CIRQO's Shopping Connector as a tool. The server
exposes one tool, cirqo_query, which forwards the question to POST {CIRQO_API_URL}/api/v1/connector/query
and returns the answer text plus the checked claims behind it. No AI key is involved: the answer is
composed by CIRQO from verified product data and every claim is checked by plain code on the server.

Run it by hand:      python backend/mcp_server.py
Point it elsewhere:  CIRQO_API_URL=http://localhost:8000 python backend/mcp_server.py

The MCP protocol runs over stdin/stdout, so this module must never print to stdout. Logging goes to stderr.
"""

import logging
import os
import sys
from typing import Any, Literal

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import BaseModel, Field

DEFAULT_API_URL = "https://frontdoor-api-hiel.onrender.com"
QUERY_PATH = "/api/v1/connector/query"
# The hosted API runs on a free tier and can take a while to wake from sleep.
TIMEOUT_SECONDS = 60.0

logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(levelname)s cirqo-mcp: %(message)s")
log = logging.getLogger("cirqo-mcp")


def api_url() -> str:
    """Base URL of the CIRQO API. Read at call time so the environment can change it."""
    return os.environ.get("CIRQO_API_URL", DEFAULT_API_URL).rstrip("/")


def make_client() -> httpx.AsyncClient:
    """The HTTP client used for the call. Tests replace this to mock the network."""
    return httpx.AsyncClient(base_url=api_url(), timeout=TIMEOUT_SECONDS)


class Constraints(BaseModel):
    """Optional filters, matching the connector manifest. Every field is optional."""

    maxPrice: float | None = Field(default=None, gt=0, description="Highest acceptable price in USD.")
    useCase: Literal["school", "work", "travel", "media"] | None = Field(default=None, description="What the laptop is for.")
    mustHave: list[Literal["battery", "light", "screen", "touch"]] | None = Field(
        default=None,
        description="Any of: battery (10h+), light (under 3 lb), screen (15 in+), touch (touchscreen).")


def build_payload(question: str, assistant_id: str, constraints: Constraints | None) -> dict[str, Any]:
    """The JSON body the connector expects. Constraints are sent only when at least one was given."""
    payload: dict[str, Any] = {"question": question, "assistantId": assistant_id}
    if constraints is not None:
        given = constraints.model_dump(exclude_none=True)
        if given:
            payload["constraints"] = given
    return payload


def error_message(response: httpx.Response) -> str:
    """CIRQO returns {"error": {"code", "message"}}. Fall back to the raw body if it does not."""
    try:
        body = response.json()
        return f"{body['error']['code']}: {body['error']['message']}"
    except (ValueError, KeyError, TypeError):
        return response.text[:300] or response.reason_phrase


server = MCPServer(
    "cirqo",
    instructions=(
        "CIRQO answers shopping questions from a brand's verified product data instead of guessing. "
        "Use cirqo_query for laptop recommendations. Every fact in the answer was checked against the "
        "verified catalog before it was returned; ranking is neutral and no brand can pay for placement. "
        "Sample data uses fictional brands."),
)


@server.tool(
    name="cirqo_query",
    description=(
        "Ask CIRQO a shopping question. Returns an answer built only from verified product facts, "
        "plus the list of checked claims behind it (each with the value stated, the verified value, "
        "and its status). If nothing in the verified catalog matches, CIRQO says so rather than guessing."),
)
async def cirqo_query(
    question: str = Field(description='The shopper\'s question, e.g. "What is the best laptop under $500 for school?"'),
    assistantId: str = Field(description='The calling assistant\'s ID registered with CIRQO, e.g. "ast_01".'),
    constraints: Constraints | None = Field(
        default=None,
        description="Optional filters (maxPrice, useCase, mustHave). Without it, maxPrice is taken from a dollar "
                    "amount in the question."),
) -> dict[str, Any]:
    payload = build_payload(question, assistantId, constraints)
    log.info("POST %s%s for %s", api_url(), QUERY_PATH, assistantId)
    try:
        async with make_client() as client:
            response = await client.post(QUERY_PATH, json=payload)
    except httpx.HTTPError as exc:
        raise ToolError(f"Could not reach CIRQO at {api_url()}: {exc}") from exc
    if response.status_code != 200:
        raise ToolError(f"CIRQO returned HTTP {response.status_code} ({error_message(response)}).")

    body = response.json()
    return {
        "answerId": body.get("answerId"),
        "answerText": body.get("answerText", ""),
        "recommendation": body.get("recommendation"),
        "alternatives": body.get("alternatives", []),
        "claims": body.get("claims", []),
        "rankingNote": body.get("rankingNote"),
        "verifiedAt": body.get("verifiedAt"),
        "source": body.get("source"),
    }


if __name__ == "__main__":
    server.run(transport="stdio")
