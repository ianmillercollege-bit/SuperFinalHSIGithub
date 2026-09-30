"""The remote MCP endpoint at /mcp answers JSON-RPC over Streamable HTTP and lists both connector tools."""
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
