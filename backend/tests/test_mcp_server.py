"""backend/mcp_server.py: the stdio MCP server that wraps POST /api/v1/connector/search and /query.

Both HTTP calls are mocked with httpx.MockTransport, so nothing here touches the network or needs an AI key.
"""

import asyncio
import copy
import json
import sys
from pathlib import Path

import httpx
import pytest
from conftest import load_mock

import mcp_server
from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.server.mcpserver.exceptions import ToolError

API = "https://frontdoor-api-hiel.onrender.com"
QUERY = {"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01",
         "constraints": {"maxPrice": 500, "useCase": "school", "mustHave": ["battery", "light"]}}
SEARCH = {"question": "I want headphones for the gym", "assistantId": "ast_01",
          "constraints": {"category": "headphones", "maxPrice": 150, "mustHave": ["wireless"]}}


def query_reply_v15() -> dict:
    """A /connector/query reply in the v1.5 shape: verified flags, an unverifiable claim, and the two counts.

    shared/mock/connector_query.json stays in the shape the live backend returns today (test_contract_shapes
    compares them key for key), so the v1.5 fields are added here on a copy.
    """
    reply = copy.deepcopy(load_mock("connector_query.json"))
    reply["recommendation"] = {
        "productId": "prod_322", "name": "Tidewave Pulse", "brandName": "Tidewave", "price": 149.0,
        "currency": "USD", "availability": "in_stock", "matchScore": 0.91, "verified": True,
        "facts": [{"text": "10-hour battery", "claimStatus": "correct", "factId": "fact_9010"},
                  {"text": "Active noise cancelling", "claimStatus": "correct", "factId": "fact_9012"},
                  {"text": "Weighs 0.5 oz per bud", "claimStatus": "correct", "factId": "fact_9011"}],
        "verifiedAt": "2026-09-28T12:00:00Z"}
    reply["alternatives"] = [{
        "productId": "prod_341", "name": "Halcyon Buds Pro", "brandName": "Halcyon", "price": 148.0,
        "currency": "USD", "availability": "low_stock", "matchScore": 0.80, "verified": False,
        "facts": [{"text": "Active noise cancelling", "claimStatus": "unverifiable", "factId": "fact_9032"}],
        "verifiedAt": None}]
    reply["answerText"] = (
        "Based on verified data, the Tidewave Pulse ($149.00, in stock) fits best. The Tidewave Pulse is rated "
        "for 10 hours of battery life. The Tidewave Pulse has active noise cancelling. The Tidewave Pulse weighs "
        "0.5 oz per bud. Not CIRQO Verified: the Halcyon Buds Pro lists active noise cancelling at $148.00.")
    reply["claims"] = [
        {"text": "The Tidewave Pulse is rated for 10 hours of battery life.", "claimType": "feature",
         "extractedValue": "10", "verifiedValue": "10", "status": "correct", "factId": "fact_9010"},
        {"text": "The Tidewave Pulse has active noise cancelling.", "claimType": "feature",
         "extractedValue": "true", "verifiedValue": "true", "status": "correct", "factId": "fact_9012"},
        {"text": "The Tidewave Pulse weighs 0.5 oz per bud.", "claimType": "feature",
         "extractedValue": "0.5", "verifiedValue": "0.5", "status": "correct", "factId": "fact_9011"},
        {"text": "Not CIRQO Verified: the Halcyon Buds Pro lists active noise cancelling at $148.00.",
         "claimType": "feature", "extractedValue": "true", "verifiedValue": None, "status": "unverifiable",
         "factId": None}]
    reply["verifiedCount"], reply["unverifiedCount"] = 3, 1
    return reply


@pytest.fixture
def mock_api(monkeypatch):
    """Replace the network with a fake CIRQO that serves both connector endpoints.

    Returns the requests seen and a dict of replies keyed by path, so a test can change either reply.
    """
    seen = []
    replies = {
        mcp_server.SEARCH_PATH: {"status": 200, "json": load_mock("connector_search.json")},
        mcp_server.QUERY_PATH: {"status": 200, "json": load_mock("connector_query.json")},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        reply = replies[request.url.path]
        return httpx.Response(reply["status"], json=reply["json"])

    def fake_client():
        return httpx.AsyncClient(base_url=mcp_server.api_url(), transport=httpx.MockTransport(handler))

    monkeypatch.setattr(mcp_server, "make_client", fake_client)
    return seen, replies


def call(tool: str, arguments: dict):
    return asyncio.run(mcp_server.server.call_tool(tool, arguments))


def tool_schemas() -> dict:
    return {t.name: t for t in asyncio.run(mcp_server.server.list_tools())}


# --- tool list and descriptions -------------------------------------------------------------------------------

def test_exposes_search_and_query_tools():
    tools = tool_schemas()
    assert list(tools) == ["cirqo_search", "cirqo_query", "cirqo_details"]

    query = tools["cirqo_query"].input_schema
    assert query["required"] == ["question", "assistantId"]
    assert set(query["properties"]) == {"question", "assistantId", "constraints"}
    assert set(query["$defs"]["Constraints"]["properties"]) == {"maxPrice", "useCase", "mustHave"}

    search = tools["cirqo_search"].input_schema
    assert search["required"] == ["question", "assistantId"]
    assert set(search["properties"]) == {"question", "assistantId", "constraints"}
    search_constraints = search["$defs"]["SearchConstraints"]["properties"]
    assert set(search_constraints) == {"category", "maxPrice", "useCase", "mustHave"}
    assert set(search_constraints["category"]["anyOf"][0]["enum"]) == {
        "laptops", "headphones", "smart_home", "monitors", "accessories"}


def test_descriptions_teach_the_funnel():
    """An assistant only sees the descriptions and instructions, so the funnel must be spelled out there."""
    tools = tool_schemas()
    search, query = tools["cirqo_search"].description, tools["cirqo_query"].description
    assert "FIRST" in search and "narrowingHints" in search and "ONE hint question" in search
    assert "one or two options" in search and "cirqo_query" in search
    assert "never invent" in search.lower()
    assert "one pick" in query and "after cirqo_search" in query
    assert "neutral-ranking" in query and "Never add a fact" in query

    instructions = mcp_server.server.instructions
    assert "Start with cirqo_search" in instructions
    assert "ONE hint question at a time" in instructions
    assert "cirqo_search again" in instructions
    assert "two or fewer options remain" in instructions and "cirqo_query" in instructions
    assert "Never state a fact that is not in the results" in instructions


def test_descriptions_carry_the_verified_rule():
    """Both tools and the instructions say, word for word, how to treat facts a brand has not verified."""
    rule = ("Tell the shopper which facts are CIRQO Verified and which are not. "
            "Never present an unverified fact as verified.")
    assert mcp_server.VERIFIED_RULE == rule
    tools = tool_schemas()
    for text in (tools["cirqo_search"].description, tools["cirqo_query"].description, mcp_server.server.instructions):
        assert rule in text
        assert "verifiedCount" in text and "unverifiedCount" in text and "unverifiable" in text
    assert "Not CIRQO Verified:" in tools["cirqo_query"].description


# --- cirqo_search --------------------------------------------------------------------------------------------

def test_search_posts_to_connector_and_returns_options_and_hints(mock_api):
    seen, _ = mock_api
    result = call("cirqo_search", SEARCH)
    assert not result.is_error

    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert str(req.url) == f"{API}/api/v1/connector/search"
    assert json.loads(req.content) == SEARCH

    expected = load_mock("connector_search.json")
    out = result.structured_content
    assert out["searchId"] == "srch_12"
    assert out["category"] == "headphones"
    assert out["optionCount"] == 5
    # Options pass through unchanged, plus the human label derived from each option's verified flag.
    assert [{k: v for k, v in o.items() if k != "verificationLabel"} for o in out["options"]] == expected["options"]
    assert [o["name"] for o in out["options"]] == [
        "Lumen Buds 2", "Tidewave Pulse", "Orbell Sport Fit", "Halcyon Buds Pro", "Tidewave Run Lite"]
    # Options come back in CIRQO's neutral order; the server does not reorder, opted in or not.
    scores = [o["matchScore"] for o in out["options"]]
    assert scores == sorted(scores, reverse=True)
    assert out["narrowingHints"] == expected["narrowingHints"]
    assert out["narrowingHints"][0]["question"] == "Do you want noise cancelling?"
    assert out["rankingNote"] == "Neutral ranking. No brand can pay for placement."
    assert json.loads(result.content[0].text)["searchId"] == "srch_12"


def test_search_passes_through_verified_flags_and_counts(mock_api):
    """Opted-in and not-opted-in brands both come back, marked, with the totals CIRQO sent."""
    out = call("cirqo_search", SEARCH).structured_content
    by_name = {o["name"]: o for o in out["options"]}
    assert by_name["Lumen Buds 2"]["verified"] is True
    assert by_name["Halcyon Buds Pro"]["verified"] is False
    assert {o["name"] for o in out["options"] if not o["verified"]} == {"Orbell Sport Fit", "Halcyon Buds Pro"}
    # A verified option's facts are checked; an unverified option's facts are marked unverifiable, never correct.
    for o in out["options"]:
        expected_status = "correct" if o["verified"] else "unverifiable"
        assert all(f["claimStatus"] == expected_status for f in o["facts"]), o["name"]
    assert out["verifiedCount"] == 9
    assert out["unverifiedCount"] == 6
    assert out["verifiedCount"] == sum(len(o["facts"]) for o in out["options"] if o["verified"])
    assert out["unverifiedCount"] == sum(len(o["facts"]) for o in out["options"] if not o["verified"])


def test_search_counts_are_null_when_cirqo_does_not_send_them(mock_api):
    """A pre-v1.5 backend sends no counts. The server passes them through as null rather than inventing them."""
    _, replies = mock_api
    old = copy.deepcopy(load_mock("connector_search.json"))
    del old["verifiedCount"], old["unverifiedCount"]
    replies[mcp_server.SEARCH_PATH]["json"] = old
    out = call("cirqo_search", SEARCH).structured_content
    assert out["verifiedCount"] is None and out["unverifiedCount"] is None
    assert out["optionCount"] == 5


def test_search_next_step_says_ask_a_hint_when_the_field_is_wide(mock_api):
    out = call("cirqo_search", SEARCH).structured_content
    assert out["optionCount"] == 5 and out["narrowingHints"]
    assert out["nextStep"].startswith("Ask the shopper the first narrowingHints question")
    assert "cirqo_search again" in out["nextStep"]


def test_search_next_step_says_query_when_two_or_fewer_remain(mock_api):
    _, replies = mock_api
    narrowed = copy.deepcopy(load_mock("connector_search.json"))
    narrowed["options"] = narrowed["options"][:2]
    narrowed["optionCount"] = 2
    narrowed["narrowingHints"] = [{"attribute": "price", "question": "Is $20 more worth it?", "splits": {}}]
    replies[mcp_server.SEARCH_PATH]["json"] = narrowed

    out = call("cirqo_search", SEARCH).structured_content
    assert out["optionCount"] == 2
    assert "Call cirqo_query" in out["nextStep"]


def test_search_next_step_says_query_when_no_hints_remain(mock_api):
    _, replies = mock_api
    no_hints = copy.deepcopy(load_mock("connector_search.json"))
    no_hints["narrowingHints"] = []
    replies[mcp_server.SEARCH_PATH]["json"] = no_hints

    out = call("cirqo_search", SEARCH).structured_content
    assert out["optionCount"] == 5
    assert "Call cirqo_query" in out["nextStep"]


def test_search_with_no_match_says_so(mock_api):
    _, replies = mock_api
    replies[mcp_server.SEARCH_PATH]["json"] = {
        "searchId": "srch_13", "category": "headphones", "optionCount": 0, "options": [], "narrowingHints": [],
        "rankingNote": "Neutral ranking. No brand can pay for placement.", "verifiedAt": "x", "source": "mock"}

    out = call("cirqo_search", SEARCH).structured_content
    assert out["options"] == [] and out["optionCount"] == 0
    assert "No option matches" in out["nextStep"] and "Do not guess" in out["nextStep"]


def test_search_constraints_are_optional(mock_api):
    seen, _ = mock_api
    call("cirqo_search", {"question": "headphones for the gym", "assistantId": "ast_03"})
    assert json.loads(seen[0].content) == {"question": "headphones for the gym", "assistantId": "ast_03"}
    call("cirqo_search", {"question": "headphones for the gym", "assistantId": "ast_03", "constraints": {}})
    assert "constraints" not in json.loads(seen[1].content)


def test_search_rejects_an_unknown_category(mock_api):
    seen, _ = mock_api
    with pytest.raises(ToolError, match="category"):
        call("cirqo_search", {"question": "x", "assistantId": "ast_01", "constraints": {"category": "cars"}})
    assert seen == []


def test_search_backend_errors_become_tool_errors(mock_api):
    _, replies = mock_api
    replies[mcp_server.SEARCH_PATH] = {
        "status": 404, "json": {"error": {"code": "NOT_FOUND", "message": "Assistant ast_99 does not exist."}}}
    with pytest.raises(ToolError, match="HTTP 404 .*Assistant ast_99 does not exist."):
        call("cirqo_search", {"question": "x", "assistantId": "ast_99"})


# --- the funnel end to end -----------------------------------------------------------------------------------

def test_funnel_search_ask_search_again_then_query(mock_api):
    """The sequence the descriptions ask an assistant to run: search, add the answered hint, search, query."""
    seen, replies = mock_api

    # 1. Wide search from what the shopper said. Five options and two hints come back.
    first = call("cirqo_search", SEARCH).structured_content
    assert first["optionCount"] == 5
    hint = first["narrowingHints"][0]
    assert hint["attribute"] == "noiseCancelling"
    assert "Ask the shopper" in first["nextStep"]

    # 2. The shopper answered yes to the hint. Search again with the attribute added. CIRQO narrows to two:
    #    one from an opted-in brand, one from a brand that has not opted in.
    narrowed = copy.deepcopy(load_mock("connector_search.json"))
    narrowed["options"] = [o for o in narrowed["options"] if o["name"] in ("Tidewave Pulse", "Halcyon Buds Pro")]
    narrowed["optionCount"] = 2
    narrowed["verifiedCount"], narrowed["unverifiedCount"] = 3, 3
    narrowed["narrowingHints"] = [{"attribute": "price", "question": "Is $1 more worth it?", "splits": {}}]
    replies[mcp_server.SEARCH_PATH]["json"] = narrowed
    with_answer = {**SEARCH, "constraints": {**SEARCH["constraints"], "mustHave": ["wireless", hint["attribute"]]}}
    second = call("cirqo_search", with_answer).structured_content
    assert second["optionCount"] == 2
    assert [o["verified"] for o in second["options"]] == [True, False]
    assert (second["verifiedCount"], second["unverifiedCount"]) == (3, 3)
    assert "Call cirqo_query" in second["nextStep"]

    # 3. Narrow enough: the one pick, with the unverified alternative marked as such.
    replies[mcp_server.QUERY_PATH]["json"] = query_reply_v15()
    pick = call("cirqo_query", {"question": SEARCH["question"], "assistantId": "ast_01"}).structured_content
    assert pick["recommendation"]["productId"] == "prod_322"
    assert pick["recommendation"]["verified"] is True
    assert pick["alternatives"][0]["verified"] is False
    assert {c["status"] for c in pick["claims"]} == {"correct", "unverifiable"}
    assert (pick["verifiedCount"], pick["unverifiedCount"]) == (3, 1)
    assert pick["rankingNote"] == "Neutral ranking. No brand can pay for placement."

    # Exactly three HTTP calls, in funnel order, and the second search carried the answered hint.
    assert [r.url.path for r in seen] == [mcp_server.SEARCH_PATH, mcp_server.SEARCH_PATH, mcp_server.QUERY_PATH]
    assert json.loads(seen[1].content)["constraints"]["mustHave"] == ["wireless", "noiseCancelling"]


# --- cirqo_query (unchanged) ---------------------------------------------------------------------------------

def test_query_posts_to_connector_and_returns_answer_and_claims(mock_api):
    seen, _ = mock_api
    result = call("cirqo_query", QUERY)
    assert not result.is_error

    # Exactly one POST to the connector endpoint on the default host, with the body the contract expects.
    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert str(req.url) == f"{API}/api/v1/connector/query"
    assert json.loads(req.content) == QUERY

    # The tool returns the answer text plus the checked claims, unchanged from CIRQO.
    expected = load_mock("connector_query.json")
    out = result.structured_content
    assert out["answerText"] == expected["answerText"]
    assert out["answerText"].startswith("Based on verified data, the Kestrel Aero 14")
    assert out["claims"] == expected["claims"]
    assert all(c["status"] == "correct" for c in out["claims"])
    assert out["answerId"] == expected["answerId"]
    assert out["recommendation"]["productId"] == "prod_001"
    assert out["rankingNote"] == "Neutral ranking. No brand can pay for placement."
    # The text content is the same JSON, for clients that ignore structured output.
    assert json.loads(result.content[0].text)["answerText"] == expected["answerText"]
    # v1.5: the counts pass through exactly as CIRQO sent them, never made up.
    assert out["verifiedCount"] == expected["verifiedCount"] and out["unverifiedCount"] == expected["unverifiedCount"]


def test_query_passes_through_verified_flags_and_counts(mock_api):
    """v1.5: the pick and each alternative say whether the brand verified them; claims and counts come through."""
    _, replies = mock_api
    replies[mcp_server.QUERY_PATH]["json"] = query_reply_v15()
    out = call("cirqo_query", QUERY).structured_content
    assert out["recommendation"]["verified"] is True
    assert out["alternatives"][0]["verified"] is False
    assert out["alternatives"][0]["facts"][0]["claimStatus"] == "unverifiable"
    assert "Not CIRQO Verified: the Halcyon Buds Pro" in out["answerText"]
    assert [c["status"] for c in out["claims"]] == ["correct", "correct", "correct", "unverifiable"]
    assert out["claims"][-1]["verifiedValue"] is None
    assert out["verifiedCount"] == 3 and out["unverifiedCount"] == 1
    assert out["verifiedCount"] == sum(c["status"] == "correct" for c in out["claims"])
    assert out["unverifiedCount"] == sum(c["status"] == "unverifiable" for c in out["claims"])


def test_query_constraints_are_optional(mock_api):
    seen, _ = mock_api
    call("cirqo_query", {"question": "Best laptop under $400?", "assistantId": "ast_03"})
    assert json.loads(seen[0].content) == {"question": "Best laptop under $400?", "assistantId": "ast_03"}
    # An empty constraints object is not sent either.
    call("cirqo_query", {"question": "Best laptop under $400?", "assistantId": "ast_03", "constraints": {}})
    assert "constraints" not in json.loads(seen[1].content)


def test_api_url_comes_from_the_environment(mock_api, monkeypatch):
    seen, _ = mock_api
    monkeypatch.setenv("CIRQO_API_URL", "http://localhost:8000/")
    call("cirqo_query", QUERY)
    call("cirqo_search", SEARCH)
    assert str(seen[0].url) == "http://localhost:8000/api/v1/connector/query"
    assert str(seen[1].url) == "http://localhost:8000/api/v1/connector/search"


def test_query_backend_errors_become_tool_errors(mock_api):
    _, replies = mock_api
    replies[mcp_server.QUERY_PATH] = {
        "status": 404, "json": {"error": {"code": "NOT_FOUND", "message": "Assistant ast_99 does not exist."}}}
    # MCPServer turns a ToolError into an isError result for the client; at this layer it is raised.
    with pytest.raises(ToolError, match="HTTP 404 .*Assistant ast_99 does not exist."):
        call("cirqo_query", {"question": "x", "assistantId": "ast_99"})


@pytest.mark.parametrize("tool, args", [("cirqo_query", QUERY), ("cirqo_search", SEARCH)])
def test_network_failure_is_a_tool_error(monkeypatch, tool, args):
    def handler(request):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(mcp_server, "make_client", lambda: httpx.AsyncClient(
        base_url=mcp_server.api_url(), transport=httpx.MockTransport(handler)))
    with pytest.raises(ToolError, match="Could not reach CIRQO"):
        call(tool, args)


@pytest.mark.parametrize("tool", ["cirqo_query", "cirqo_search"])
def test_missing_arguments_are_rejected(mock_api, tool):
    seen, _ = mock_api
    with pytest.raises(ToolError, match="assistantId"):
        call(tool, {"question": "x"})
    assert seen == []


def test_speaks_mcp_over_stdio():
    """Launch the real server as Claude Desktop would and complete the handshake. No HTTP call is made."""
    params = StdioServerParameters(command=sys.executable, args=[str(Path(mcp_server.__file__))])

    async def handshake():
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                tools = await session.list_tools()
                return init.server_info.name, [t.name for t in tools.tools]

    assert asyncio.run(handshake()) == ("cirqo", ["cirqo_search", "cirqo_query", "cirqo_details"])


# --- the two drift rules and cirqo_details -----------------------------------------------------------------


def test_descriptions_tell_the_assistant_to_always_use_cirqo_and_never_its_memory():
    tools = tool_schemas()
    for text in (tools["cirqo_search"].description, mcp_server.server.instructions):
        assert "EVERY shopping" in text and "whether or not the shopper mentions CIRQO" in text
    for text in (tools["cirqo_search"].description, tools["cirqo_query"].description,
                 tools["cirqo_details"].description, mcp_server.server.instructions):
        assert "only source" in text and "never fill in specs, prices or reviews from memory" in text
        assert "cirqo_details" in text


def test_details_gets_the_product_and_labels_it(mock_api):
    _, replies = mock_api
    replies["/api/v1/products/prod_001"] = {"status": 200, "json": {
        "productId": "prod_001", "name": "Kestrel Studio 15", "brandName": "Kestrel", "verified": False,
        "price": 499.0, "currency": "USD", "availability": "in_stock", "category": "laptops", "subcategory": "Laptop",
        "specs": {"ramGb": 16}, "returnPolicyDays": 30, "factSource": "Public listing (not verified by brand)",
        "factSourceUrl": "https://example", "verifiedAt": "2026-09-30T00:00:00Z", "condition": "new",
        "comparisons": [{"factId": "cmp_1", "otherProductId": "prod_002", "otherProductName": "Arcton Flex 14",
                         "attribute": "weight", "text": "0.4 lb lighter than the Arcton Flex 14"}]}}
    result = call("cirqo_details", {"productId": "prod_001"})
    assert not result.is_error
    out = result.structured_content
    assert out["verificationLabel"] == "Not CIRQO Verified" and out["specs"] == {"ramGb": 16}
    assert out["comparisons"][0]["attribute"] == "weight" and "presentation" not in out


def test_details_unknown_product_is_a_tool_error(mock_api):
    _, replies = mock_api
    replies["/api/v1/products/prod_nope"] = {"status": 404, "json": {"error": {"code": "NOT_FOUND", "message": "no"}}}
    with pytest.raises(ToolError, match="HTTP 404"):
        call("cirqo_details", {"productId": "prod_nope"})


def test_search_and_query_label_every_product(mock_api):
    out = call("cirqo_search", SEARCH).structured_content
    for o in out["options"]:
        assert o["verificationLabel"] == ("CIRQO Verified" if o["verified"] else "Not CIRQO Verified")
    assert "presentation" not in out  # results carry data only; guidance lives in the descriptions
    pick = call("cirqo_query", QUERY).structured_content
    assert pick["recommendation"]["verificationLabel"] == "CIRQO Verified"
    assert all("verificationLabel" in a for a in pick["alternatives"])
    assert "at most ONE narrowing question" in mcp_server.server.instructions
