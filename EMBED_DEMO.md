# Embed the CIRQO demo chat on any website

A visitor chats with Claude, and Claude answers through the CIRQO plugin. It searches the verified catalog,
asks one narrowing question, gives one verified pick, and labels every product **CIRQO Verified** or
**Not CIRQO Verified**. Each CIRQO tool call appears as a card in the chat. A side panel lights up as each CIRQO
feature appears.

The page is served by the backend at:

```
https://frontdoor-api-hiel.onrender.com/demo
```

## 1. Paste this into your website

Put it wherever the demo should appear. It works in any HTML page, and in a site built in Claude chat: ask
Claude to "add this iframe as the demo section" and paste the snippet.

```html
<section id="cirqo-demo" style="max-width:1100px;margin:0 auto;padding:16px;">
  <iframe
    src="https://frontdoor-api-hiel.onrender.com/demo"
    title="Try CIRQO with Claude"
    style="width:100%;height:640px;border:1px solid #dde2e9;border-radius:12px;background:#f5f6f8;"
    loading="lazy"
    allow="clipboard-write">
  </iframe>
</section>
```

Options you can add to the URL:

| Parameter | Effect |
|---|---|
| `?theme=light` or `?theme=dark` | Force a color theme. By default it follows the visitor's system setting. |
| `?legend=0` | Hide the "What CIRQO adds" side panel, for narrow layouts. The panel also hides itself on phones. |

Example: `https://frontdoor-api-hiel.onrender.com/demo?theme=light&legend=0`

## 2. Live Claude or scripted

| Backend setting | What visitors get | Badge |
|---|---|---|
| `ANTHROPIC_API_KEY` set on Render | Real Claude (`AI_MODEL`, default `claude-sonnet-5-5`) runs the funnel with the same tools, descriptions and instructions as the `/mcp` connector. | **Live Claude** |
| No key, or the model is unavailable | Plain code runs the same funnel with the same CIRQO tools, so the demo never breaks. | **Scripted demo** |

To turn on live mode, open Render, then the `frontdoor-api` service, then **Environment**. Add
`ANTHROPIC_API_KEY` and redeploy. Live mode does not depend on `MOCK_MODE`. Demo messages share the AI Coach's
rate limits: `COACH_RATE_PER_MIN` per visitor and `COACH_DAILY_CAP` per day in total. Also set a spend limit in
the Anthropic console.

## 3. Cold starts

The backend is on Render's free tier and sleeps after 15 idle minutes. When the page loads, it pings `/health`
to wake the server while the visitor reads the welcome card. The first reply can still take up to a minute.
Before a live presentation, open the `/demo` URL once to wake the server.

## How it is built

| Piece | File |
|---|---|
| Chat page (self-contained HTML, no build step) | `backend/static/demo.html` |
| `GET /demo` and `POST /api/v1/demo/chat` | `backend/routers/demo.py` |
| Claude tool loop and the scripted fallback | `backend/services/demo_chat.py` |
| Tests (no network, no AI key) | `backend/tests/test_demo_chat.py` |

Tool calls go through `mcp_server.server.call_tool()`, the same code a Claude custom connector reaches at `/mcp`.
The demo therefore shows exactly what the plugin does.
