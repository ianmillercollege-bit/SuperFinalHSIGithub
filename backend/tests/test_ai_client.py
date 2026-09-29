"""Live AI extraction (BACKEND_CONTRACT.md section 3). No real API calls: Claude is replaced by a fake."""

import json
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from services import ai_client
from settings import settings

FAKE_KEY = "test-key-not-real"
TEXT = ("The Kestrel Aero 14 costs $399. It has an 11-hour battery. It is certified child-safe. "
        "The Zephyr Book 13 is great. The Novex Slate 14 is sleeker than the Kestrel Aero 14.")
AI_REPLY = {"claims": [
    {"sentence": "The Kestrel Aero 14 costs $399.", "kind": "price", "product_name": "Kestrel Aero 14",
     "spec_name": None, "stated_value": "399", "compared_product_name": None},
    # A pronoun the regex path cannot resolve on its own sentence; Claude names the product.
    {"sentence": "It has an 11-hour battery.", "kind": "spec", "product_name": "Kestrel Aero 14",
     "spec_name": "batteryHours", "stated_value": "11", "compared_product_name": None},
    # Claude calls this a feature; plain code still files it under SAFETY_LEGAL from the keyword list.
    {"sentence": "It is certified child-safe.", "kind": "feature", "product_name": "Kestrel Aero 14",
     "spec_name": None, "stated_value": "child safety certification", "compared_product_name": None},
    {"sentence": "The Zephyr Book 13 is great.", "kind": "unknown_product", "product_name": "Zephyr Book 13",
     "spec_name": None, "stated_value": None, "compared_product_name": None},
    # "sleeker than" is not in the DECISIONS.md #8 phrase list, so plain code does not judge it.
    {"sentence": "The Novex Slate 14 is sleeker than the Kestrel Aero 14.", "kind": "comparison",
     "product_name": "Novex Slate 14", "spec_name": None, "stated_value": None,
     "compared_product_name": "Kestrel Aero 14"},
]}


class FakeClaude:
    """Stands in for anthropic.Anthropic and records how it was called."""

    calls: list = []

    def __init__(self, reply=None, error=None, stop_reason="end_turn"):
        self.reply, self.error, self.stop_reason = reply, error, stop_reason

    def factory(self):
        fake = self

        class Client:
            def __init__(self, **kwargs):
                FakeClaude.calls.append(("client", kwargs))
                self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

            def create(self, **kwargs):
                FakeClaude.calls.append(("create", kwargs))
                if fake.error:
                    raise fake.error
                text = fake.reply if isinstance(fake.reply, str) else json.dumps(fake.reply)
                return SimpleNamespace(stop_reason=fake.stop_reason,
                                       content=[SimpleNamespace(type="text", text=text)])
        return Client


@pytest.fixture
def live(monkeypatch):
    """MOCK_MODE=false with a (fake) key. Returns a function that installs a fake Claude."""
    FakeClaude.calls = []
    monkeypatch.setattr(settings, "mock_mode", False)
    monkeypatch.setattr(settings, "anthropic_api_key", FAKE_KEY)

    def install(**kwargs):
        monkeypatch.setattr(ai_client.anthropic, "Anthropic", FakeClaude(**kwargs).factory())
    return install


def run(client, text=TEXT):
    res = client.post("/api/v1/checker/run", json={"answerText": text, "assistantId": "ast_02", "queryText": "q"})
    assert res.status_code == 200, res.text
    return res.json()


def test_mock_mode_never_calls_the_ai(client, monkeypatch):
    monkeypatch.setattr(ai_client.anthropic, "Anthropic", lambda **k: pytest.fail("AI called in mock mode"))
    assert run(client)["source"] == "mock"


def test_live_extraction_is_judged_by_plain_code(client, live):
    live(reply=AI_REPLY)
    body = run(client)
    assert body["source"] == "live"
    by_text = {c["text"]: c for c in body["claims"]}
    assert (by_text["The Kestrel Aero 14 costs $399."]["ruleId"], by_text["The Kestrel Aero 14 costs $399."]["status"]) \
        == ("PRICE_MISMATCH", "incorrect")
    assert by_text["It has an 11-hour battery."]["status"] == "correct"
    assert by_text["It is certified child-safe."]["ruleId"] == "SAFETY_LEGAL"
    assert by_text["The Zephyr Book 13 is great."]["ruleId"] == "NO_FACT"
    assert "The Novex Slate 14 is sleeker than the Kestrel Aero 14." not in by_text
    # Incidents follow the plain-code severity rules; NO_FACT creates none.
    incidents = [client.get(f"/api/v1/incidents/{i}").json() for i in body["incidentsCreated"]]
    assert sorted(i["ruleId"] for i in incidents) == ["PRICE_MISMATCH", "SAFETY_LEGAL"]
    # Stored answer and audit say an AI model did the extraction.
    stored = next(a for a in client.get("/api/v1/answers?limit=100").json()["answers"] if a["answerId"] == body["answerId"])
    assert stored["source"] == "live"
    entry = next(e for e in client.get(f"/api/v1/audit?targetId={body['answerId']}").json()["entries"]
                 if e["action"] == "claim_extracted")
    assert (entry["actor"], entry["actorType"]) == (settings.ai_model, "ai")


def test_request_follows_contract(client, live):
    live(reply={"claims": []})
    run(client)
    (_, client_kwargs), (_, request) = FakeClaude.calls
    assert client_kwargs == {"api_key": FAKE_KEY, "timeout": 30.0, "max_retries": 0}  # 30 s, no silent retries
    assert request["model"] == settings.ai_model == "claude-sonnet-5-5"
    assert request["fallbacks"] == "default" and request["betas"] == ["server-side-fallback-2026-07-01"]
    assert request["output_config"]["format"]["type"] == "json_schema"
    assert "Kestrel Aero 14" in request["system"]  # the catalog is given for name resolution
    assert TEXT in request["messages"][0]["content"]


@pytest.mark.parametrize("problem", [
    {"error": anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))},
    {"error": anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))},
    {"reply": {"claims": []}, "stop_reason": "refusal"},
    {"reply": {"claims": []}, "stop_reason": "max_tokens"},
    {"reply": "not json"},
    {"reply": {"claims": [{"sentence": "x"}]}},  # wrong shape
])
def test_any_failure_falls_back_to_plain_code(client, live, problem):
    live(**problem)
    body = run(client)
    assert body["source"] == "fallback"
    # Same claims the plain regex path finds.
    assert any(c["ruleId"] == "PRICE_MISMATCH" for c in body["claims"])


def test_missing_key_falls_back_without_calling(client, monkeypatch):
    monkeypatch.setattr(settings, "mock_mode", False)
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    monkeypatch.setattr(ai_client.anthropic, "Anthropic", lambda **k: pytest.fail("called without a key"))
    assert run(client)["source"] == "fallback"


def test_real_sdk_request_and_response(client, monkeypatch):
    """The real anthropic SDK, pointed at a local stand-in server: checks the wire format both ways."""
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    seen = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            seen["path"], seen["headers"] = self.path, dict(self.headers)
            seen["body"] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            reply = json.dumps({
                "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5",
                "content": [{"type": "text", "text": json.dumps(AI_REPLY)}], "stop_reason": "end_turn",
                "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 10}}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(reply)))
            self.end_headers()
            self.wfile.write(reply)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{server.server_port}")
        monkeypatch.setattr(settings, "mock_mode", False)
        monkeypatch.setattr(settings, "anthropic_api_key", FAKE_KEY)
        body = run(client)
    finally:
        server.shutdown()

    assert body["source"] == "live"
    assert any(c["ruleId"] == "PRICE_MISMATCH" for c in body["claims"])
    assert seen["path"].startswith("/v1/messages")
    headers = {k.lower(): v for k, v in seen["headers"].items()}
    assert headers["x-api-key"] == FAKE_KEY
    assert "server-side-fallback-2026-07-01" in headers["anthropic-beta"]
    assert seen["body"]["model"] == "claude-sonnet-5-5" and seen["body"]["fallbacks"] == "default"
    assert seen["body"]["output_config"]["format"]["type"] == "json_schema"


def test_key_never_logged(client, live, caplog):
    live(error=anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages")))
    with caplog.at_level("DEBUG"):
        run(client)
    assert FAKE_KEY not in caplog.text
    assert "timed out" in caplog.text
