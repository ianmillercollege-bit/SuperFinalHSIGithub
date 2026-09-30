"""CIRQO as an MCP server (stdio).

Lets an MCP client such as Claude Desktop call CIRQO's Shopping Connector as tools. The server exposes two:

  cirqo_search  POST {CIRQO_API_URL}/api/v1/connector/search   the funnel: up to 5 verified options plus
                                                               narrowing hints (questions to ask the shopper)
  cirqo_query   POST {CIRQO_API_URL}/api/v1/connector/query    the one pick: an answer text built only from
                                                               verified facts plus the checked claims behind it

The funnel an assistant runs on its own: search from whatever the shopper said; if narrowing hints come back,
ask one hint question at a time in plain words and search again with the added constraint; when one or two
options remain, query for the single pick. No AI key is involved: every fact is checked by plain code on the
CIRQO server, ranking is neutral, and the assistant must never state a fact that is not in the results.
Since v1.5 the catalog also holds brands that have not opted in: their products carry verified=false, their
facts are claimStatus "unverifiable", and every response counts verifiedCount and unverifiedCount. The
assistant must tell the shopper which facts are verified by the brand and which are not.

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
SEARCH_PATH = "/api/v1/connector/search"
QUERY_PATH = "/api/v1/connector/query"
# The hosted API runs on a free tier and can take a while to wake from sleep.
TIMEOUT_SECONDS = 60.0
# With this many options or fewer, the funnel is narrow enough to ask for the one pick.
PICK_THRESHOLD = 2
# Spelled out on both tools and in the server instructions: the one rule about unverified facts.
VERIFIED_RULE = ("Tell the shopper which facts are verified by the brand and which are not. "
                 "Never present an unverified fact as verified.")

Category = Literal["laptops", "headphones", "smart_home", "monitors", "accessories"]

logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(levelname)s cirqo-mcp: %(message)s")
log = logging.getLogger("cirqo-mcp")


def api_url() -> str:
    """Base URL of the CIRQO API. Read at call time so the environment can change it."""
    return os.environ.get("CIRQO_API_URL", DEFAULT_API_URL).rstrip("/")


def make_client() -> httpx.AsyncClient:
    """The HTTP client used for the calls. Tests replace this to mock the network."""
    return httpx.AsyncClient(base_url=api_url(), timeout=TIMEOUT_SECONDS)


class Constraints(BaseModel):
    """Optional filters for the one-pick call, matching the connector manifest. Every field is optional."""

    maxPrice: float | None = Field(default=None, gt=0, description="Highest acceptable price in USD.")
    useCase: Literal["school", "work", "travel", "media"] | None = Field(default=None, description="What the laptop is for.")
    mustHave: list[Literal["battery", "light", "screen", "touch"]] | None = Field(
        default=None,
        description="Any of: battery (10h+), light (under 3 lb), screen (15 in+), touch (touchscreen).")


class SearchConstraints(BaseModel):
    """Optional filters for the funnel call. Every field is optional; add one per answered narrowing hint."""

    category: Category | None = Field(
        default=None,
        description="Product category. Leave it out to let CIRQO infer it from the question.")
    maxPrice: float | None = Field(default=None, gt=0, description="Highest acceptable price in USD.")
    useCase: Literal["school", "work", "travel", "media"] | None = Field(
        default=None, description="What the product is for, when the shopper said.")
    mustHave: list[str] | None = Field(
        default=None,
        description=(
            "Attribute tags the product must have. Laptops: battery (10h+), light (under 3 lb), screen (15 in+), "
            "touch. Other categories use the attribute names from narrowingHints, e.g. wireless, noiseCancelling. "
            "After the shopper answers a hint question with yes, add that hint's attribute here."))


def build_payload(question: str, assistant_id: str, constraints: BaseModel | None) -> dict[str, Any]:
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


async def post_to_cirqo(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST one connector call and return its JSON body. Network and HTTP errors become tool errors."""
    log.info("POST %s%s for %s", api_url(), path, payload.get("assistantId"))
    try:
        async with make_client() as client:
            response = await client.post(path, json=payload)
    except httpx.HTTPError as exc:
        raise ToolError(f"Could not reach CIRQO at {api_url()}: {exc}") from exc
    if response.status_code != 200:
        raise ToolError(f"CIRQO returned HTTP {response.status_code} ({error_message(response)}).")
    return response.json()


def next_step(option_count: int, hints: list[Any]) -> str:
    """What the assistant should do after a search, spelled out so it does not have to work it out."""
    if option_count == 0:
        return "No option matches. Tell the shopper so and offer to relax a constraint. Do not guess."
    if option_count <= PICK_THRESHOLD or not hints:
        return "Narrow enough. Call cirqo_query with the same question and constraints for the single pick."
    return ("Ask the shopper the first narrowingHints question in plain words, then call cirqo_search again "
            "with their answer added to constraints.")


server = MCPServer(
    "cirqo",
    instructions=(
        "CIRQO answers shopping questions from brands' verified product data instead of guessing. Every fact "
        "was checked against the verified catalog before it was returned; ranking is neutral and no brand can "
        "pay for placement. Sample data uses fictional brands.\n\n"
        "Run the funnel on your own, without being told to:\n"
        "1. Start with cirqo_search from whatever the shopper said, however vague. Do not ask clarifying "
        "questions before the first search.\n"
        "2. If the result has narrowingHints, ask the shopper ONE hint question at a time, in plain words "
        "(you may reword the hint's question, e.g. \"Do you want noise cancelling?\"). Do not list every hint "
        "at once and do not ask about attributes the hints do not mention.\n"
        "3. Call cirqo_search again with the answer added to constraints (or restated in the question).\n"
        "4. When one or two options remain, or no hints come back, call cirqo_query for the single pick and "
        "present it: the product, its verified facts, and the rankingNote about neutral ranking.\n"
        "5. Never state a fact that is not in the results. If CIRQO finds nothing, say so rather than guessing.\n"
        "6. Results mix opted-in brands (verified: true, facts checked against the brand's data, claimStatus "
        "correct) and brands that have not opted in (verified: false, facts from public listings, claimStatus "
        "unverifiable); verifiedCount and unverifiedCount total them. " + VERIFIED_RULE),
)


@server.tool(
    name="cirqo_search",
    description=(
        "Step 1 of the CIRQO funnel. Call this FIRST, from whatever the shopper said, even a vague sentence like "
        "\"headphones for the gym\". Returns up to 5 verified options ordered by neutral matchScore, each with "
        "checked facts, plus narrowingHints: the attributes on which those options differ most, each phrased "
        "as a question. Then follow nextStep in the result: if hints came back and more than two options "
        "remain, ask the shopper ONE hint question in plain words and call cirqo_search again with their "
        "answer added to constraints; when one or two options remain (or no hints), call cirqo_query for the "
        "single pick. Present only facts from options[].facts; never invent one. An empty options list means "
        "nothing matches, so say that instead of guessing. Each option carries verified (true when the brand "
        "opted in and its facts were checked, false when the facts come from a public listing) and each fact "
        "carries claimStatus (correct or unverifiable); verifiedCount and unverifiedCount total them. "
        + VERIFIED_RULE),
)
async def cirqo_search(
    question: str = Field(description='What the shopper said, e.g. "I want headphones for the gym".'),
    assistantId: str = Field(description='The calling assistant\'s ID registered with CIRQO, e.g. "ast_01".'),
    constraints: SearchConstraints | None = Field(
        default=None,
        description="Optional filters (category, maxPrice, useCase, mustHave). Without it, CIRQO infers category "
                    "and maxPrice from the question. Add one constraint per answered narrowing hint."),
) -> dict[str, Any]:
    body = await post_to_cirqo(SEARCH_PATH, build_payload(question, assistantId, constraints))
    options = body.get("options", [])
    hints = body.get("narrowingHints", [])
    option_count = body.get("optionCount", len(options))
    return {
        "searchId": body.get("searchId"),
        "category": body.get("category"),
        "optionCount": option_count,
        "options": options,
        "narrowingHints": hints,
        "nextStep": next_step(option_count, hints),
        "verifiedCount": body.get("verifiedCount"),
        "unverifiedCount": body.get("unverifiedCount"),
        "rankingNote": body.get("rankingNote"),
        "verifiedAt": body.get("verifiedAt"),
        "source": body.get("source"),
    }


@server.tool(
    name="cirqo_query",
    description=(
        "Final step of the CIRQO funnel: the one pick. Call this after cirqo_search has narrowed the field to "
        "one or two options (or returned no narrowingHints), passing the same question and the constraints "
        "gathered from the shopper's answers. Returns an answer built only from verified product facts, the "
        "recommendation with alternatives, the list of checked claims behind it (each with the value stated, "
        "the verified value, and its status), and the rankingNote. Present the single pick with its verified "
        "facts and mention the neutral-ranking note. Never add a fact that is not in the result. If nothing in "
        "the catalog matches, CIRQO says so rather than guessing; pass that on. The recommendation and each "
        "alternative carry verified (true when the brand opted in, false when its facts come from a public "
        "listing); claims carry status correct or unverifiable, answerText prefixes unverified facts with "
        "\"Not verified by the brand:\", and verifiedCount and unverifiedCount total them. " + VERIFIED_RULE),
)
async def cirqo_query(
    question: str = Field(description='The shopper\'s question, e.g. "What is the best laptop under $500 for school?"'),
    assistantId: str = Field(description='The calling assistant\'s ID registered with CIRQO, e.g. "ast_01".'),
    constraints: Constraints | None = Field(
        default=None,
        description="Optional filters (maxPrice, useCase, mustHave). Without it, maxPrice is taken from a dollar "
                    "amount in the question."),
) -> dict[str, Any]:
    body = await post_to_cirqo(QUERY_PATH, build_payload(question, assistantId, constraints))
    return {
        "answerId": body.get("answerId"),
        "answerText": body.get("answerText", ""),
        "recommendation": body.get("recommendation"),
        "alternatives": body.get("alternatives", []),
        "claims": body.get("claims", []),
        "verifiedCount": body.get("verifiedCount"),
        "unverifiedCount": body.get("unverifiedCount"),
        "rankingNote": body.get("rankingNote"),
        "verifiedAt": body.get("verifiedAt"),
        "source": body.get("source"),
    }


if __name__ == "__main__":
    server.run(transport="stdio")
