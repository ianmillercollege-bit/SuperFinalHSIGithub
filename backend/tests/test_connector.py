"""BACKEND_CONTRACT.md v1.1 section 7, "Connector" (and section 11: test_connector)."""

import json
from pathlib import Path

from conftest import DEFAULT_ANSWERS
from sqlalchemy import select

from db import Brand, SessionLocal
from timeutil import today

QUERY = {"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01",
         "constraints": {"maxPrice": 500, "useCase": "school", "mustHave": ["battery", "light"]}}
MANIFEST = Path(__file__).resolve().parents[1] / "connector" / "manifest.json"


def ask(client, body=QUERY):
    res = client.post("/api/v1/connector/query", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def test_connector(client):
    # Returns only correct claims.
    body = ask(client)
    assert body["recommendation"]["productId"] == "prod_001"
    assert body["claims"] and all(c["status"] == "correct" and c["ruleId"] is None for c in body["claims"])
    assert all(c["answerId"] == body["answerId"] for c in body["claims"])
    assert all(f["claimStatus"] == "correct" for f in body["recommendation"]["facts"])
    assert body["rankingNote"] == "Neutral ranking. No brand can pay for placement."
    assert body["source"] == "mock"

    # Stored as an answer citing the brand's own verified feed.
    stored = next(a for a in client.get("/api/v1/answers?limit=100").json()["answers"]
                  if a["answerId"] == body["answerId"])
    assert stored["sourceIds"] == ["src_brand"]
    assert stored["queryText"] == QUERY["question"] and stored["answerText"] == body["answerText"]
    assert (stored["brandMentioned"], stored["rank"], stored["assistantName"]) == (True, 1, "Assistant A")
    assert client.get(f"/api/v1/claims?answerId={body['answerId']}").json()["claims"] == \
        sorted(body["claims"], key=lambda c: c["claimId"], reverse=True)

    # Writes a connector_query audit entry by the assistant.
    entries = client.get(f"/api/v1/audit?targetId={body['answerId']}").json()["entries"]
    assert [(e["action"], e["actorType"], e["actor"]) for e in entries] == [("connector_query", "ai", "Assistant A")]

    # 422 and 404 cases.
    for bad in ({"question": "x"},
                {"question": "x", "assistantId": "ast_01", "constraints": {"useCase": "gaming"}},
                {"question": "x", "assistantId": "ast_01", "constraints": {"mustHave": ["gpu"]}},
                {"question": "x", "assistantId": "ast_01", "constraints": {"maxPrice": 0}},
                {"question": "x", "assistantId": "ast_01", "constraints": {"maxPrice": -5}}):
        res = client.post("/api/v1/connector/query", json=bad)
        assert res.status_code == 422 and res.json()["error"]["code"] == "VALIDATION_ERROR", bad
    res = client.post("/api/v1/connector/query", json={"question": "x", "assistantId": "ast_99"})
    assert res.status_code == 404 and res.json() == {
        "error": {"code": "NOT_FOUND", "message": "Assistant ast_99 does not exist."}}

    # Manifest loads, and is exactly the static file.
    manifest = client.get("/api/v1/connector/manifest").json()
    assert manifest == json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert {"name", "description", "version", "tools"} <= set(manifest)
    assert [t["name"] for t in manifest["tools"]] == ["search", "query"]  # v1.4: the funnel
    assert manifest["tools"][0]["inputSchema"]["required"] == ["question", "assistantId"]


def test_answer_text_only_states_verified_facts(client):
    body = ask(client)
    text = body["answerText"]
    assert text.startswith("Based on verified data, the Kestrel Aero 14 ($449.99, in stock) fits best.")
    for fact in ("11 hours of battery life", "2.9 lb", "8 GB of RAM", "256 GB of storage", "30-day return policy"):
        assert fact in text
    # Re-checking the stored answer finds nothing new and nothing wrong.
    rerun = client.post("/api/v1/checker/run", json={"answerId": body["answerId"]}).json()
    assert rerun["incidentsCreated"] == []
    assert all(c["status"] == "correct" for c in rerun["claims"])


def test_same_ranking_as_shopper(client):
    shopper = client.post("/api/v1/shopper/recommend", json=DEFAULT_ANSWERS).json()
    connector = ask(client)
    assert connector["recommendation"]["productId"] == shopper["recommendation"]["productId"]
    assert [a["productId"] for a in connector["alternatives"]] == [a["productId"] for a in shopper["alternatives"]]


def test_ranking_ignores_who_pays(client):
    media = {"question": "Laptop for movies?", "assistantId": "ast_02",
             "constraints": {"maxPrice": 700, "useCase": "media", "mustHave": ["screen", "touch"]}}

    def order(body):
        b = ask(client, body)
        return [b["recommendation"]["productId"]] + [a["productId"] for a in b["alternatives"]]

    before = [order(QUERY), order(media)]
    with SessionLocal() as db:
        for b in db.scalars(select(Brand)).all():
            b.is_client, b.billing_tier = not b.is_client, "enterprise"
        db.commit()
    assert [order(QUERY), order(media)] == before
    assert ask(client, media)["recommendation"]["brandName"] in ("Arcton", "Novex")  # a competitor can win


def test_no_match_is_honest_and_still_recorded(client):
    body = ask(client, {"question": "Best laptop under $300?", "assistantId": "ast_02"})
    assert body["recommendation"] is None and body["alternatives"] == []
    assert "No product in the verified catalog matches" in body["answerText"] and "under $300" in body["answerText"]
    assert body["claims"] == []
    assert any(a["answerId"] == body["answerId"] for a in client.get("/api/v1/answers?limit=100").json()["answers"])
    entries = client.get(f"/api/v1/audit?targetId={body['answerId']}").json()["entries"]
    assert entries[0]["action"] == "connector_query" and "no matching product" in entries[0]["details"]


def test_max_price_from_question_when_no_constraints(client):
    body = ask(client, {"question": "What should I buy for under $400?", "assistantId": "ast_03"})
    assert body["recommendation"]["price"] <= 400
    assert all(a["price"] <= 400 for a in body["alternatives"])
    # "At most" $449.99 includes the $449.99 laptop.
    exact = ask(client, {"question": "anything", "assistantId": "ast_01", "constraints": {"maxPrice": 449.99}})
    assert exact["recommendation"]["price"] <= 449.99


def test_connector_shows_up_in_dashboard(client):
    answers_before = len(client.get("/api/v1/answers?limit=100").json()["answers"])
    daily_before = client.get("/api/v1/metrics/trust").json()["daily"][-1]
    body = ask(client)
    assert len(client.get("/api/v1/answers?limit=100").json()["answers"]) == answers_before + 1
    daily_after = client.get("/api/v1/metrics/trust").json()["daily"][-1]
    assert daily_after["date"] == today().isoformat()
    kestrel = {p["productId"] for p in client.get("/api/v1/products").json()["products"] if p["brandId"] == "brand_001"}
    # Each claim counts toward the brand whose product it is about (Kestrel here; a Novex alternative counts for Novex).
    assert daily_after["claimsChecked"] == daily_before["claimsChecked"] + sum(c["productId"] in kestrel for c in body["claims"])
    assert daily_after["accuracyRate"] >= daily_before["accuracyRate"]  # only correct claims were added
    sources = {s["sourceId"]: s for s in client.get("/api/v1/sources").json()["sources"]}
    assert sources["src_brand"]["citationCount"] >= 1 and sources["src_brand"]["accuracyRate"] == 1.0
