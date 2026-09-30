"""CIRQO connector as a remote MCP endpoint, mounted inside the FastAPI app at /mcp.

Same two tools as backend/mcp_server.py (cirqo_search, cirqo_query), served over Streamable HTTP so a shopper
can enable CIRQO in claude.ai with "Add custom connector" and the URL https://<backend>/mcp. Nothing to install.

The tools call the REST API over loopback (same process, same port), so the answer is the same one the
dashboard's Preview as shopper gets. Stateless and JSON-only: every request stands alone, which suits a
free-tier host that sleeps and wakes.
"""
from __future__ import annotations

import os

from mcp.server.streamable_http_manager import StreamableHTTPASGIApp
from mcp.server.transport_security import TransportSecuritySettings

# Point the tools at this very process. Render sets PORT; local runs use uvicorn's default 8000.
os.environ.setdefault("CIRQO_API_URL", f"http://127.0.0.1:{os.environ.get('PORT', '8000')}")

from mcp_server import server as mcp_server  # noqa: E402  (after the env default on purpose)

MCP_PATH = "/mcp"

# Building the Starlette app creates the session manager; we then register the transport on the host app
# as a plain route at /mcp (an exact path, so no trailing-slash redirect for clients that POST).
# Served behind a real hostname, so the localhost-only DNS-rebinding allowlist must be switched off.
mcp_server.streamable_http_app(
    streamable_http_path="/",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)
mcp_asgi = StreamableHTTPASGIApp(mcp_server.session_manager)


def session_manager():
    """The host app's lifespan must run this manager; a mounted sub-app's own lifespan never runs."""
    return mcp_server.session_manager
