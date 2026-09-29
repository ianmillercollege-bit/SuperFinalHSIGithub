"""backend/mcp_server.py: the stdio MCP server that wraps POST /api/v1/connector/query.

The HTTP call is mocked with httpx.MockTransport, so nothing here touches the network or needs an AI key.
"""

import asyncio
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

QUERY = {"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01",
         "constraints": {"maxPrice": 500, "useCase": "school", "mustHave": ["battery", "light"]}}


@pytest.fixture
def mock_api(monkeypatch):
    """Replace the network with a fake CIRQO. Returns the requests seen, and lets a test choose the reply."""
    seen = []
    reply = {"status": 200, "json": load_mock("connector_query.json")}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(reply["status"], json=reply["json"])

    def fake_client():
        return httpx.AsyncClient(base_url=mcp_server.api_url(), transport=httpx.MockTransport(handler))

    monkeypatch.setattr(mcp_server, "make_client", fake_client)
    return seen, reply


def call(arguments: dict):
    return asyncio.run(mcp_server.server.call_tool("cirqo_query", arguments))


def test_exposes_one_tool_with_the_connector_schema():
    tools = asyncio.run(mcp_server.server.list_tools())
    assert [t.name for t in tools] == ["cirqo_query"]
    schema = tools[0].input_schema
    assert schema["required"] == ["question", "assistantId"]
    assert set(schema["properties"]) == {"question", "assistantId", "constraints"}
    constraints = schema["$defs"]["Constraints"]["properties"]
    assert set(constraints) == {"maxPrice", "useCase", "mustHave"}


def test_query_posts_to_connector_and_returns_answer_and_claims(mock_api):
    seen, _ = mock_api
    result = call(QUERY)
    assert not result.is_error

    # Exactly one POST to the connector endpoint on the default host, with the body the contract expects.
    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert str(req.url) == "https://frontdoor-api-hiel.onrender.com/api/v1/connector/query"
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


def test_constraints_are_optional(mock_api):
    seen, _ = mock_api
    call({"question": "Best laptop under $400?", "assistantId": "ast_03"})
    assert json.loads(seen[0].content) == {"question": "Best laptop under $400?", "assistantId": "ast_03"}
    # An empty constraints object is not sent either.
    call({"question": "Best laptop under $400?", "assistantId": "ast_03", "constraints": {}})
    assert "constraints" not in json.loads(seen[1].content)


def test_api_url_comes_from_the_environment(mock_api, monkeypatch):
    seen, _ = mock_api
    monkeypatch.setenv("CIRQO_API_URL", "http://localhost:8000/")
    call(QUERY)
    assert str(seen[0].url) == "http://localhost:8000/api/v1/connector/query"


def test_backend_errors_become_tool_errors(mock_api):
    _, reply = mock_api
    reply["status"], reply["json"] = 404, {"error": {"code": "NOT_FOUND", "message": "Assistant ast_99 does not exist."}}
    # MCPServer turns a ToolError into an isError result for the client; at this layer it is raised.
    with pytest.raises(ToolError, match="HTTP 404 .*Assistant ast_99 does not exist."):
        call({"question": "x", "assistantId": "ast_99"})


def test_network_failure_is_a_tool_error(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(mcp_server, "make_client", lambda: httpx.AsyncClient(
        base_url=mcp_server.api_url(), transport=httpx.MockTransport(handler)))
    with pytest.raises(ToolError, match="Could not reach CIRQO"):
        call(QUERY)


def test_missing_arguments_are_rejected(mock_api):
    seen, _ = mock_api
    with pytest.raises(ToolError, match="assistantId"):
        call({"question": "x"})
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

    assert asyncio.run(handshake()) == ("cirqo", ["cirqo_query"])
