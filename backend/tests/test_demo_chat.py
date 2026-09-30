"""Website demo chat (routers/demo.py, services/demo_chat.py). No network and no real AI calls:
CIRQO tool calls and Claude are both replaced by fakes."""

from types import SimpleNamespace

import pytest

from routers import coach as coach_router
from services import demo_chat
from settings import settings

SEARCH = {
    "searchId": "srch_1", "category": "headphones", "optionCount": 3,
    "options": [
        {"productId": "prod_A", "name": "Deimos Quanta X", "brandName": "Deimos", "price": 68.99, "verified": True,
         "verificationLabel": "CIRQO Verified",
         "facts": [{"text": "$68.99", "claimStatus": "correct"}, {"text": "10-hour battery", "claimStatus": "correct"}]},
        {"productId": "prod_B", "name": "JBL Peak 3", "brandName": "JBL", "price": 99.95, "verified": False,
         "verificationLabel": "Not CIRQO Verified", "facts": [{"text": "In stock", "claimStatus": "unverifiable"}]},
        {"productId": "prod_C", "name": "Hedone Prism", "brandName": "Hedone", "price": 115.99, "verified": True,
         "verificationLabel": "CIRQO Verified", "facts": []},
    ],
    "narrowingHints": [{"attribute": "noiseCancelling", "question": "Do you want noise cancelling?"}],
    "verifiedCount": 2, "unverifiedCount": 1, "rankingNote": "Neutral ranking. No brand can pay for placement.",
}
DETAILS = {"productId": "prod_C", "name": "Hedone Prism", "verified": True, "comparisons": [{"text": "Lighter than X."}]}


@pytest.fixture(autouse=True)
def fake_tools(monkeypatch):
    calls = []

    async def run_tool(name, args):
        calls.append((name, args))
        if name == "cirqo_search":
            narrowed = "constraints" in args
            return ({**SEARCH, "options": SEARCH["options"][2:]} if narrowed else SEARCH), None
        if name == "cirqo_details":
            return DETAILS, None
        return None, "unexpected tool"

    monkeypatch.setattr(demo_chat, "run_tool", run_tool)
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    coach_router.reset_limits()
    yield calls
    coach_router.reset_limits()


def chat(client, *texts):
    roles = ["user", "assistant"]
    return client.post("/api/v1/demo/chat",
                       json={"messages": [{"role": roles[i % 2], "text": t} for i, t in enumerate(texts)]})


def test_demo_page_is_served_and_frameable(client):
    res = client.get("/demo")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    assert "x-frame-options" not in res.headers
    assert "/api/v1/demo/chat" in res.text


def test_scripted_first_turn_lists_options_with_labels_and_asks_one_question(client, fake_tools):
    res = chat(client, "headphones for the gym")
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "scripted"
    assert "Deimos Quanta X** (CIRQO Verified)" in body["reply"]
    assert "JBL Peak 3** (Not CIRQO Verified)" in body["reply"]
    assert body["reply"].rstrip().endswith("Do you want noise cancelling?")
    assert [c["tool"] for c in body["toolCalls"]] == ["cirqo_search"]
    assert body["toolCalls"][0]["products"][1]["verified"] is False


def test_scripted_yes_answer_narrows_and_gives_one_pick(client, fake_tools):
    body = chat(client, "headphones for the gym", "Found 3 options. Do you want noise cancelling?", "yes").json()
    assert body["reply"].startswith("My pick: **Hedone Prism** (CIRQO Verified)")
    assert "Neutral ranking" in body["reply"]
    assert ("cirqo_search", {"question": "headphones for the gym", "assistantId": "ast_01",
                             "constraints": {"category": "headphones", "mustHave": ["noiseCancelling"]}}) in fake_tools
    assert fake_tools[-1] == ("cirqo_details", {"productId": "prod_C"})


def test_conversation_must_end_with_a_user_message(client):
    res = client.post("/api/v1/demo/chat", json={"messages": [{"role": "user", "text": "hi"},
                                                                {"role": "assistant", "text": "hello"}]})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def block(**kw):
    return SimpleNamespace(**kw)


class FakeClaude:
    """Two rounds: one cirqo_search tool call, then the final text."""

    def __init__(self, **client_kwargs):
        self.requests = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    async def create(self, **kwargs):
        self.requests.append(kwargs)
        if len(self.requests) == 1:
            return block(stop_reason="tool_use", content=[
                block(type="tool_use", id="tu_1", name="cirqo_search",
                      input={"question": "gym headphones", "assistantId": "ast_01"})])
        return block(stop_reason="end_turn", content=[block(type="text", text="**Deimos Quanta X** (CIRQO Verified)")])


def test_live_mode_runs_the_tool_loop_with_the_connector_tools(client, monkeypatch, fake_tools):
    fake = FakeClaude()
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key-not-real")
    monkeypatch.setattr(demo_chat.anthropic, "AsyncAnthropic", lambda **kw: fake)
    body = chat(client, "gym headphones").json()
    assert body["mode"] == "live"
    assert body["reply"] == "**Deimos Quanta X** (CIRQO Verified)"
    assert body["toolCalls"][0]["tool"] == "cirqo_search"
    first, second = fake.requests
    assert sorted(t["name"] for t in first["tools"]) == ["cirqo_details", "cirqo_query", "cirqo_search"]
    assert "CIRQO Verified" in first["system"]
    assert first["fallbacks"] == "default"
    result = second["messages"][-1]["content"][0]
    assert result["type"] == "tool_result" and result["tool_use_id"] == "tu_1" and not result["is_error"]


def test_live_mode_falls_back_to_the_script_when_claude_refuses(client, monkeypatch):
    async def refuse(**kwargs):
        return block(stop_reason="refusal", content=[])

    monkeypatch.setattr(settings, "anthropic_api_key", "test-key-not-real")
    monkeypatch.setattr(demo_chat.anthropic, "AsyncAnthropic",
                        lambda **kw: SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=refuse))))
    body = chat(client, "gym headphones").json()
    assert body["mode"] == "scripted"
    assert "scripted demo" in body["note"]
