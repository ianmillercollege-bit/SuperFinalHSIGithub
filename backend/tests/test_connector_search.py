"""BACKEND_CONTRACT.md v1.4 section 7c, "Connector search (the funnel)" (test_connector_search), with the
v1.5 section 7d verified flags and counts."""

from pathlib import Path

import pytest
from sqlalchemy import select

from db import Answer, Brand, Product, SessionLocal
from seed_loader import rebuild_database

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"
GYM = {"question": "I want headphones for the gym", "assistantId": "ast_01"}
HINT_ATTRIBUTES = {"noiseCancelling", "wireless", "touchscreen", "subcategory", "weightOz", "weightLb", "weightG",
                   "batteryHours", "screenInches", "price"}


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def search(client, body) -> dict:
    res = client.post("/api/v1/connector/search", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def all_products(client) -> dict:
    return {p["productId"]: p for p in client.get("/api/v1/products").json()["products"]}


def test_connector_search(seeded):
    body = search(seeded, GYM)
    # Category inferred from "headphones"; at most 5 options, best first.
    assert body["category"] == "headphones"
    assert 0 < body["optionCount"] == len(body["options"]) <= 5
    scores = [o["matchScore"] for o in body["options"]]
    assert scores == sorted(scores, reverse=True)
    products = all_products(seeded)
    assert {products[o["productId"]]["category"] for o in body["options"]} == {"headphones"}
    assert body["searchId"].startswith("srch_")
    assert body["rankingNote"] == "Neutral ranking. No brand can pay for placement."

    # Every fact passes the checker.
    for option in body["options"]:
        assert option["facts"]
        if option["verified"]:  # v1.5: opted-in brand, every fact checked
            assert all(f["claimStatus"] == "correct" and f["factId"].startswith("fact_") for f in option["facts"])
        else:  # not opted in: public-listing facts, labelled honestly
            assert all(f["claimStatus"] == "unverifiable" for f in option["facts"])
    # v1.5 / contract 7d: the counts total the options by their verified flag; the real seed mixes both.
    assert body["verifiedCount"] == sum(1 for o in body["options"] if o["verified"])
    assert body["unverifiedCount"] == sum(1 for o in body["options"] if not o["verified"])
    assert body["verifiedCount"] + body["unverifiedCount"] == body["optionCount"]

    # Recorded as an answer (with its claims) and audited connector_search.
    answer_id = "ans_" + body["searchId"].split("_", 1)[1]
    with SessionLocal() as db:
        stored = db.get(Answer, answer_id)
        assert stored.query_text == GYM["question"] and stored.assistant_id == "ast_01"
        assert all(option["name"] in stored.answer_text for option in body["options"])
    assert answer_id in {a["answerId"] for a in seeded.get("/api/v1/answers", params={"limit": 5}).json()["answers"]}
    claims = seeded.get("/api/v1/claims", params={"answerId": answer_id}).json()["claims"]
    assert claims and all(c["status"] == "correct" for c in claims)
    entries = seeded.get("/api/v1/audit", params={"targetId": answer_id}).json()["entries"]
    assert [(e["action"], e["actorType"]) for e in entries] == [("connector_search", "ai")]


@pytest.mark.parametrize("question, constraints", [
    ("I want headphones for the gym", None),
    ("Best laptop under $500 for school?", None),
    ("a tablet for drawing", None),
    ("something for my desk", {"category": "computer_hardware", "maxPrice": 300}),
], ids=["gym", "laptop", "tablet", "hardware"])
def test_hints_name_real_differing_attributes(seeded, question, constraints):
    body = search(seeded, {"question": question, "assistantId": "ast_02",
                           **({"constraints": constraints} if constraints else {})})
    hints = body["narrowingHints"]
    assert len(hints) <= 3 and len({h["attribute"] for h in hints}) == len(hints)
    products = all_products(seeded)
    options = [products[o["productId"]] for o in body["options"]]
    for hint in hints:
        assert hint["attribute"] in HINT_ATTRIBUTES and hint["question"].endswith((".", "?"))
        # Each hint splits the options into at least two non-empty groups.
        assert len(hint["splits"]) >= 2 and all(n > 0 for n in hint["splits"].values())
        assert sum(hint["splits"].values()) == body["optionCount"]
        # Numeric hints: the options really differ on that attribute.
        spec = {"weightOz": "weightG", "batteryHours": "batteryHours", "weightLb": "weightLb", "weightG": "weightG",
                "screenInches": "screenInches"}.get(hint["attribute"])
        if spec:
            assert len({o["specs"][spec] for o in options}) > 1, hint
        if hint["attribute"] == "price":
            assert len({o["price"] for o in options}) > 1


def test_constraints_narrow_the_funnel(seeded):
    first = search(seeded, GYM)
    hint = first["narrowingHints"][0]
    key = next(iter(hint["splits"]))
    must = key if hint["attribute"] not in ("noiseCancelling", "wireless", "touchscreen") else hint["attribute"]
    narrowed = search(seeded, {**GYM, "constraints": {"mustHave": [must]}})
    assert narrowed["optionCount"] >= 1
    assert all(p["productId"] for p in narrowed["options"])

    capped = search(seeded, {**GYM, "constraints": {"maxPrice": 80}})
    assert capped["options"] and all(o["price"] <= 80 for o in capped["options"])
    by_dollars = search(seeded, {"question": "headphones for the gym under $80", "assistantId": "ast_01"})
    assert [o["productId"] for o in by_dollars["options"]] == [o["productId"] for o in capped["options"]]

    # A subcategory named in the question narrows the category: graphics cards, not keyboards.
    gpus = search(seeded, {"question": "graphics card for gaming", "assistantId": "ast_01"})
    products = all_products(seeded)
    assert gpus["category"] == "computer_hardware"
    assert {products[o["productId"]]["subcategory"] for o in gpus["options"]} == {"Graphics Card"}


def test_no_match_is_honest(seeded):
    body = search(seeded, {**GYM, "constraints": {"mustHave": ["unicornhorn"]}})
    assert (body["optionCount"], body["options"], body["narrowingHints"]) == (0, [], [])
    assert (body["verifiedCount"], body["unverifiedCount"]) == (0, 0)
    entries = seeded.get("/api/v1/audit", params={"limit": 1}).json()["entries"]
    assert entries[0]["action"] == "connector_search" and "no matching product" in entries[0]["details"]


def test_laptop_search_matches_query_ranking(seeded):
    """Same neutral ranking as /connector/query: the query's pick is the search's first option."""
    body = {"question": "Best laptop under $500 for school?", "assistantId": "ast_01",
            "constraints": {"maxPrice": 500, "useCase": "school", "mustHave": ["battery", "light"]}}
    found = search(seeded, body)
    pick = seeded.post("/api/v1/connector/query", json=body).json()["recommendation"]
    assert found["options"][0]["productId"] == pick["productId"]


def test_search_ranking_ignores_billing(seeded):
    """Section 8: flipping isClient and billingTier (plan) on every brand leaves the order unchanged."""
    before = [o["productId"] for o in search(seeded, GYM)["options"]]
    with SessionLocal() as db:
        for b in db.scalars(select(Brand)).all():
            b.is_client = not b.is_client
            b.opted_in = not b.opted_in  # v1.5: the verified label never moves a product
            b.billing_tier = "enterprise" if b.billing_tier != "enterprise" else "starter"
        db.commit()
    assert [o["productId"] for o in search(seeded, GYM)["options"]] == before


def test_unverified_brands_are_labelled(seeded, monkeypatch):
    """v1.5: options from brands that have not opted in carry verified=false and unverifiable facts."""
    first = search(seeded, GYM)
    with SessionLocal() as db:
        brand_id = db.get(Product, first["options"][0]["productId"]).brand_id
    monkeypatch.setattr("services.search.brand_verified", lambda b: b is not None and b.brand_id != brand_id)
    monkeypatch.setattr("routers.connector.brand_verified", lambda b: b is not None and b.brand_id != brand_id)
    body = search(seeded, GYM)
    assert [o["productId"] for o in body["options"]] == [o["productId"] for o in first["options"]]  # same order
    top = body["options"][0]
    assert top["verified"] is False and all(f["claimStatus"] == "unverifiable" for f in top["facts"])
    assert body["verifiedCount"] + body["unverifiedCount"] == body["optionCount"] and body["unverifiedCount"] >= 1
    with SessionLocal() as db:
        answer = db.get(Answer, "ans_" + body["searchId"].split("_", 1)[1])
        assert f"Not verified by the brand: option 1 is the {top['name']}" in answer.answer_text


def test_search_validation(seeded):
    for bad in ({"assistantId": "ast_01"}, {"question": "  ", "assistantId": "ast_01"},
                {**GYM, "constraints": {"maxPrice": -5}}, {**GYM, "constraints": {"category": "cars"}},
                {**GYM, "constraints": {"mustHave": ["x" * 41]}}, {**GYM, "constraints": {"mustHave": [""]}}):
        res = seeded.post("/api/v1/connector/search", json=bad)
        assert res.status_code == 422 and res.json()["error"]["code"] == "VALIDATION_ERROR", bad
    res = seeded.post("/api/v1/connector/search", json={**GYM, "assistantId": "ast_99"})
    assert res.status_code == 404 and res.json()["error"]["code"] == "NOT_FOUND"
