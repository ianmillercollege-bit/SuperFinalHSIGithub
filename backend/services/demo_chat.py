"""Website demo chat: Claude using the CIRQO plugin, embeddable in any page as an iframe (GET /demo).

The browser sends the conversation so far; the reply comes back with every CIRQO tool call Claude made,
so the page can show the plugin at work (search, one narrowing question, the pick, the verified labels).

  ANTHROPIC_API_KEY set  -> "mode": "live"      Claude runs the funnel with the same tools, descriptions
                                                and instructions the MCP connector (/mcp) serves.
  no key / model error   -> "mode": "scripted"  plain code runs the same funnel against the same tools,
                                                so the demo always works on a site that has no AI key.

Tool calls go through mcp_server.server.call_tool(): the exact code path a real Claude connector uses.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import anthropic

from mcp_server import server as cirqo_mcp
from settings import settings

log = logging.getLogger("cirqo.demo_chat")

TIMEOUT_SECONDS = 60.0
MAX_TOOL_ROUNDS = 6
MAX_TOKENS = 4000
FALLBACK_BETA = "server-side-fallback-2026-07-01"
ASSISTANT_ID = "ast_01"
# The funnel tools only; the ChatGPT-shaped search/fetch wrappers would just be duplicates here.
DEMO_TOOLS = ("cirqo_search", "cirqo_query", "cirqo_details")

DEMO_PROMPT = (
    "You are Claude, running live on the CIRQO website as a demo of the CIRQO plugin (an MCP connector). "
    "Visitors are trying it the way a shopper would inside their own assistant. Keep replies short and easy to "
    "scan: a short intro line, then a compact list, then at most one question. Use light Markdown (bold product "
    "names, bullet lists), no tables and no headings. Use assistantId \"" + ASSISTANT_ID + "\" on every CIRQO call. "
    "If the visitor asks what CIRQO is or how the demo works, explain briefly in plain words: CIRQO gives AI "
    "assistants verified product facts from the brands themselves, labels every product CIRQO Verified or Not "
    "CIRQO Verified, ranks neutrally (no brand can pay for placement), and checks every claim before it leaves "
    "CIRQO. All brands and products in this demo are fictional sample data, except the labelled public listings. "
    "Politely steer off-topic requests back to shopping for laptops, headphones, phones, tablets or computer "
    "hardware.\n\n")


# ---- Tools ---------------------------------------------------------------------------------------


async def run_tool(name: str, args: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    """Call one CIRQO tool. Returns (result, None) or (None, error text). Tests replace this."""
    if name not in DEMO_TOOLS:
        return None, f"Unknown tool {name}."
    try:
        result = await cirqo_mcp.call_tool(name, args)
    except Exception as exc:  # ToolError and validation errors both end up as a message for the model
        return None, str(exc)
    if getattr(result, "is_error", False):
        return None, " ".join(getattr(c, "text", "") for c in result.content) or "CIRQO returned an error."
    if result.structured_content:
        return dict(result.structured_content), None
    text = "".join(getattr(c, "text", "") for c in result.content)
    try:
        return json.loads(text), None
    except ValueError:
        return {"text": text}, None


def summarize(name: str, args: dict[str, Any], result: dict[str, Any] | None, error: str | None) -> dict[str, Any]:
    """What the page shows for one tool call: a one-line headline and the products it returned."""
    call: dict[str, Any] = {"tool": name, "input": args}
    if error:
        call.update(ok=False, headline=f"Error: {error[:200]}")
        return call
    result = result or {}
    products: list[dict[str, Any]] = []
    if name == "cirqo_search":
        products = result.get("options") or []
        hint = (result.get("narrowingHints") or [{}])[0].get("question")
        headline = (f"{result.get('optionCount', len(products))} options, {result.get('verifiedCount') or 0} "
                    f"CIRQO Verified, {result.get('unverifiedCount') or 0} not")
        if hint:
            headline += f". Suggested question: “{hint}”"
    elif name == "cirqo_query":
        rec = result.get("recommendation")
        products = ([rec] if rec else []) + (result.get("alternatives") or [])
        claims = result.get("claims") or []
        checked = sum(1 for c in claims if c.get("status") == "correct")
        headline = (f"Pick: {rec['name']}. {checked} of {len(claims)} claims checked correct" if rec
                    else "No product matches")
    else:
        products = [result] if result.get("productId") else []
        headline = f"Full record: {result.get('name')}, {len(result.get('comparisons') or [])} verified comparisons"
    call.update(ok=True, headline=headline, rankingNote=result.get("rankingNote"), products=[
        {"productId": p.get("productId"), "name": p.get("name"), "brandName": p.get("brandName"),
         "price": p.get("price"), "verified": bool(p.get("verified")),
         "verificationLabel": p.get("verificationLabel") or ("CIRQO Verified" if p.get("verified") else "Not CIRQO Verified")}
        for p in products[:6]])
    return call


async def tool_definitions() -> list[dict[str, Any]]:
    """The connector's own tool schemas and descriptions, in the Messages API shape."""
    return [{"name": t.name, "description": t.description or "", "input_schema": t.input_schema}
            for t in await cirqo_mcp.list_tools() if t.name in DEMO_TOOLS]


# ---- Live: Claude runs the funnel ----------------------------------------------------------------


async def live_reply(history: list[dict[str, str]]) -> dict[str, Any] | None:
    """Claude answers with the CIRQO tools. None when the model cannot be used (caller falls back)."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=TIMEOUT_SECONDS, max_retries=1)
    tools = await tool_definitions()
    messages: list[dict[str, Any]] = [{"role": t["role"], "content": t["text"]} for t in history]
    calls: list[dict[str, Any]] = []
    try:
        for _ in range(MAX_TOOL_ROUNDS):
            response = await client.beta.messages.create(
                model=settings.ai_model,
                max_tokens=MAX_TOKENS,
                system=DEMO_PROMPT + (cirqo_mcp.instructions or ""),
                tools=tools,
                messages=messages,
                output_config={"effort": "low"},
                betas=[FALLBACK_BETA],
                fallbacks="default",
            )
            if response.stop_reason == "refusal":
                return None
            if response.stop_reason != "tool_use":
                text = "".join(b.text for b in response.content if b.type == "text").strip()
                return {"reply": text, "toolCalls": calls, "mode": "live"} if text else None
            # Thinking and tool_use blocks go back exactly as received.
            messages.append({"role": "assistant", "content": response.content})
            results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                result, error = await run_tool(block.name, dict(block.input))
                calls.append(summarize(block.name, dict(block.input), result, error))
                results.append({"type": "tool_result", "tool_use_id": block.id, "is_error": bool(error),
                                "content": error or json.dumps(result)})
            messages.append({"role": "user", "content": results})
    except anthropic.APIConnectionError:
        log.warning("Demo chat: could not reach the model.")
        return None
    except anthropic.APIStatusError as e:
        log.warning("Demo chat: model returned HTTP %s.", e.status_code)
        return None
    log.warning("Demo chat: tool loop did not finish in %d rounds.", MAX_TOOL_ROUNDS)
    return None


# ---- Scripted: the same funnel in plain code -----------------------------------------------------

YES = re.compile(r"^\s*(y|yes|yeah|yep|sure|ok|okay|definitely|please|absolutely)\b", re.I)


def _money(value: Any) -> str:
    return f"${value:,.2f}" if isinstance(value, (int, float)) else "price not listed"


def _product_line(p: dict[str, Any]) -> str:
    facts = [f["text"] for f in p.get("facts") or [] if not f["text"].startswith("$")][:3]
    label = p.get("verificationLabel") or ("CIRQO Verified" if p.get("verified") else "Not CIRQO Verified")
    return f"- **{p['name']}** ({label}), {_money(p.get('price'))}" + (f": {', '.join(facts)}" if facts else "")


def _constraint_for(hint: dict[str, Any]) -> dict[str, Any]:
    """The search constraint a "yes" to this narrowing hint adds."""
    attribute = hint.get("attribute", "")
    if attribute == "price":
        match = re.search(r"\$(\d+)", hint.get("question", ""))
        return {"maxPrice": float(match.group(1))} if match else {}
    return {"mustHave": [attribute]} if attribute else {}


async def scripted_reply(history: list[dict[str, str]]) -> dict[str, Any]:
    """Turn 1: search and ask the first narrowing question. Turn 2: apply the answer and give the pick.
    Any later message starts a fresh search."""
    user_turns = [t["text"] for t in history if t["role"] == "user"]
    asked = len(user_turns) >= 2 and "?" in next((t["text"] for t in reversed(history) if t["role"] == "assistant"), "")
    first = user_turns[-2] if asked else user_turns[-1]
    calls: list[dict[str, Any]] = []

    async def call(name: str, args: dict[str, Any]) -> dict[str, Any] | None:
        result, error = await run_tool(name, args)
        calls.append(summarize(name, args, result, error))
        return result

    search = await call("cirqo_search", {"question": first, "assistantId": ASSISTANT_ID})
    if search is None:
        return {"reply": "I could not reach the CIRQO catalog just now. Please try again in a moment.",
                "toolCalls": calls, "mode": "scripted"}
    options = search.get("options") or []
    if not options:
        return {"reply": "CIRQO found nothing in the verified catalog that matches, so I won't guess. "
                         "Try a laptop, headphones, a phone, a tablet or computer hardware, with a budget.",
                "toolCalls": calls, "mode": "scripted"}
    hints = search.get("narrowingHints") or []

    if not asked:
        lines = [f"CIRQO found {len(options)} options, ranked neutrally:", "", *map(_product_line, options)]
        comparison = search.get("publicComparison")
        if comparison:
            lines += ["", f"For comparison, from a brand that has not opted in: **{comparison['name']}** "
                          f"(Not CIRQO Verified), {_money(comparison.get('price'))}"]
        if hints and len(options) > 2:
            lines += ["", hints[0]["question"]]
        return {"reply": "\n".join(lines), "toolCalls": calls, "mode": "scripted"}

    constraints = {"category": search.get("category")} if search.get("category") else {}
    if hints and YES.match(user_turns[-1]):
        constraints.update(_constraint_for(hints[0]))
    narrowed = search
    if len(constraints) > 1:
        narrowed = await call("cirqo_search", {"question": first, "assistantId": ASSISTANT_ID,
                                               "constraints": constraints}) or search
    top = (narrowed.get("options") or options)[0]
    details = await call("cirqo_details", {"productId": top["productId"]}) or {}
    lines = [f"My pick: **{top['name']}** ({top.get('verificationLabel', 'CIRQO Verified')}), {_money(top.get('price'))}.",
             "", *[f"- {f['text']}" for f in top.get("facts") or [] if not f["text"].startswith("$")]]
    comparisons = [c.get("text") for c in details.get("comparisons") or [] if c.get("text")][:2]
    if comparisons:
        lines += ["", "Verified comparisons: " + " ".join(comparisons)]
    lines += ["", narrowed.get("rankingNote") or "Neutral ranking. No brand can pay for placement."]
    return {"reply": "\n".join(lines), "toolCalls": calls, "mode": "scripted"}


# ---- Entry point ---------------------------------------------------------------------------------


async def answer(history: list[dict[str, str]]) -> dict[str, Any]:
    """The reply to the last user turn. Never raises for model problems: those end in the scripted funnel."""
    if settings.anthropic_api_key:
        reply = await live_reply(history)
        if reply:
            return reply
        out = await scripted_reply(history)
        out["note"] = "The AI model was unavailable, so this reply comes from the scripted demo."
        return out
    return await scripted_reply(history)
