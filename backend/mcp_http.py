"""CIRQO connector as a remote MCP endpoint, served by the FastAPI app at POST /mcp.

Same two funnel tools as backend/mcp_server.py (plus cirqo_details), over Streamable HTTP, so a shopper can
enable CIRQO in claude.ai with "Add custom connector" and the URL https://<backend>/mcp. Nothing to install.

Stateless and JSON-only: every request stands alone, which suits a free-tier host that sleeps and wakes.
On Render the tools call the REST API over loopback (same process, same port); elsewhere they use the
public URL, so the local stdio server and the tests behave exactly as before.
"""
from __future__ import annotations

import os

from mcp.server.streamable_http_manager import StreamableHTTPASGIApp, StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings

if os.environ.get("RENDER") and "CIRQO_API_URL" not in os.environ:
    os.environ["CIRQO_API_URL"] = f"http://127.0.0.1:{os.environ.get('PORT', '8000')}"

from mcp_server import server as mcp_server  # noqa: E402  (after the env default on purpose)

MCP_PATH = "/mcp"

# Served behind a real hostname, so the localhost-only DNS-rebinding allowlist is switched off.
SECURITY = TransportSecuritySettings(enable_dns_rebinding_protection=False)

# Building the Starlette app once gives us the low-level server the session manager wraps.
_lowlevel = mcp_server.streamable_http_app(streamable_http_path="/", stateless_http=True, json_response=True,
                                           transport_security=SECURITY) and mcp_server.session_manager.app


def new_session_manager() -> StreamableHTTPSessionManager:
    """A session manager can run only once, so the host app's lifespan makes a fresh one on every start
    (uvicorn starts once; the test client starts once per `with` block)."""
    return StreamableHTTPSessionManager(app=_lowlevel, stateless=True, json_response=True, security_settings=SECURITY)


# Registered on the host app as an exact route at /mcp (no trailing-slash redirect for clients that POST).
mcp_asgi = StreamableHTTPASGIApp(new_session_manager())


def start():
    """Swap in a fresh manager and return its run() context for the host lifespan to enter."""
    manager = new_session_manager()
    mcp_asgi.session_manager = manager
    return manager.run()
