"""The remote MCP endpoint at /mcp answers JSON-RPC over Streamable HTTP and lists both connector tools."""
import os
import subprocess
import sys
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from main import app

HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def rpc(client: TestClient, method: str, params: dict | None = None, rpc_id: int = 1) -> dict:
    body = {"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params or {}}
    res = client.post("/mcp", json=body, headers=HEADERS, follow_redirects=False)
    assert res.status_code == 200, res.text
    return res.json()


def test_mcp_initialize_and_tools_list():
    # The lifespan must run so the session manager is started (with-block does that).
    with TestClient(app) as client:
        init = rpc(client, "initialize", {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "pytest", "version": "0"}})
        assert init["result"]["serverInfo"]["name"]
        tools = rpc(client, "tools/list", rpc_id=2)
        names = {t["name"] for t in tools["result"]["tools"]}
        assert {"cirqo_search", "cirqo_query"} <= names


def test_mcp_does_not_disturb_rest_api():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/api/v1/connector/manifest").status_code == 200


def test_lifespan_can_be_entered_more_than_once():
    """A session manager runs only once, so each lifespan must build a fresh one (the suite starts the app a lot)."""
    for _ in range(3):
        with TestClient(app) as client:
            tools = rpc(client, "tools/list")
            assert {t["name"] for t in tools["result"]["tools"]} == {"cirqo_search", "cirqo_query"}


def test_importing_the_app_leaves_cirqo_api_url_alone():
    """The loopback URL is handed to the tools per request, never written into the process environment.

    Checked in a fresh interpreter, since this process imported main long ago.
    """
    env = {k: v for k, v in os.environ.items() if k != "CIRQO_API_URL"}
    code = "import os, main, mcp_server; print('CIRQO_API_URL' in os.environ, mcp_server.api_url())"
    out = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[1],
                         env=env, capture_output=True, text=True, check=True).stdout.split()
    assert out == ["False", "https://frontdoor-api-hiel.onrender.com"]


def test_tools_called_over_mcp_post_to_loopback(monkeypatch):
    """A tool called through /mcp posts to this process; the stdio server keeps seeing the default URL."""
    import mcp_server

    monkeypatch.delenv("CIRQO_API_URL", raising=False)
    monkeypatch.setenv("PORT", "4321")
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        return httpx.Response(200, json={"searchId": "srch_1", "optionCount": 0, "options": [], "narrowingHints": []})

    monkeypatch.setattr(mcp_server, "make_client", lambda: httpx.AsyncClient(
        base_url=mcp_server.api_url(), transport=httpx.MockTransport(handler)))

    with TestClient(app) as client:
        res = rpc(client, "tools/call", {
            "name": "cirqo_search", "arguments": {"question": "headphones for the gym", "assistantId": "ast_01"}})
    assert res["result"]["structuredContent"]["optionCount"] == 0
    assert seen == ["http://127.0.0.1:4321/api/v1/connector/search"]
    # Outside a /mcp request nothing changed for the stdio server.
    assert mcp_server.api_url() == mcp_server.DEFAULT_API_URL
