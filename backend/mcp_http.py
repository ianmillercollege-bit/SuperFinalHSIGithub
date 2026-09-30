"""CIRQO connector as a remote MCP endpoint, mounted inside the FastAPI app at /mcp.

Same tools as backend/mcp_server.py (cirqo_search, cirqo_query, cirqo_details), served over Streamable HTTP so a shopper
can enable CIRQO in claude.ai with "Add custom connector" and the URL https://<backend>/mcp. Nothing to install.

The tools call the REST API over loopback (same process, same port), so the answer is the same one the
dashboard's Preview as shopper gets. Stateless and JSON-only: every request stands alone, which suits a
free-tier host that sleeps and wakes.

Two things are deliberately not done at import time:
  - The loopback URL is not written into the process environment. It is handed to the tools per request
    through mcp_server.api_url_override, so importing this module (main.py does) never changes what the
    stdio server, or anything else reading CIRQO_API_URL, sees.
  - The session manager is not built once. Its run() may be entered only once per instance, and the test
    suite starts the app's lifespan many times, so each lifespan builds a fresh one.
"""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from starlette.types import Receive, Scope, Send

from mcp_server import api_url_override
from mcp_server import server as mcp_server

MCP_PATH = "/mcp"

# The manager serving /mcp right now: set while the host app's lifespan is inside mcp_lifespan(), else None.
_running: StreamableHTTPSessionManager | None = None


def loopback_url() -> str:
    """Where the tools post during a /mcp request: this very process, unless CIRQO_API_URL says otherwise.

    Render sets PORT; local runs use uvicorn's default 8000.
    """
    return os.environ.get("CIRQO_API_URL") or f"http://127.0.0.1:{os.environ.get('PORT', '8000')}"


def new_session_manager() -> StreamableHTTPSessionManager:
    """A fresh session manager. One instance can run only once, so every lifespan asks for a new one.

    Building the Starlette app is the public way to create a manager; the app itself is discarded because
    the transport is registered on the host app as a plain route at /mcp (an exact path, so no trailing-slash
    redirect for clients that POST). Served behind a real hostname, so the localhost-only DNS-rebinding
    allowlist must be switched off.
    """
    mcp_server.streamable_http_app(
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return mcp_server.session_manager


@asynccontextmanager
async def mcp_lifespan() -> AsyncIterator[None]:
    """Run a session manager for the life of the host app. A mounted sub-app's own lifespan never runs."""
    global _running
    previous = _running
    manager = new_session_manager()
    async with manager.run():
        _running = manager
        try:
            yield
        finally:
            _running = previous


class MCPEndpoint:
    """The ASGI app registered at /mcp. Forwards to the running manager with the loopback URL in effect."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        manager = _running
        if manager is None:
            raise RuntimeError("The MCP session manager is not running: the host app's lifespan must enter mcp_lifespan().")
        # Tasks the manager starts for this request copy the current context, so the tools see the override.
        token = api_url_override.set(loopback_url())
        try:
            await manager.handle_request(scope, receive, send)
        finally:
            api_url_override.reset(token)


mcp_asgi = MCPEndpoint()
