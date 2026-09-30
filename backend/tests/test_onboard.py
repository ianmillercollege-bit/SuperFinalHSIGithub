"""BACKEND_CONTRACT.md v1.3 section 7b: POST /api/v1/brands/onboard ("Connect your catalog")."""

import json
import re

import pytest
from conftest import load_mock
from sqlalchemy import select

from db import Brand, SessionLocal
from seed_loader import rebuild_database

BODY = {"brandName": "Lumen Audio", "ownerName": "Sam Rivera",
        "products": [{"name": "Lumen Buds 2", "price": 129.00, "availability": "in_stock",
                      "specs": {"batteryHours": 8, "weightLb": 0.1, "touchscreen": False},
                      "returnPolicyDays": 30, "factSource": "Brand product feed",
                      "factSourceUrl": "https://www.lumenaudio.example/buds-2"}]}


def onboard(client, body=BODY):
    return client.post("/api/v1/brands/onboard", json=body)


def assert_same_keys(real, mock):
    assert set(real) == set(mock)
    for key, value in mock.items():
        if isinstance(value, dict):
            assert_same_keys(real[key], value)
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            for item in real[key]:
                assert_same_keys(item, value[0])


def test_onboard(client):
    # 201 with the contract shape.
    res = onboard(client)
    assert res.status_code == 201
    body = res.json()
    assert_same_keys(body, load_mock("brands_onboard.json"))
    assert (body["brandId"], body["brandName"], body["productsCreated"], body["connectorReady"]) == \
        ("brand_004", "Lumen Audio", 1, True)
    assert body["note"] == "Demo data. Resets when the server restarts."
    assert re.fullmatch(r"fd_lumen-audio_[0-9a-f]{4}", body["apiKey"])
    assert [(o["name"], o["role"]) for o in body["owners"]] == [("Sam Rivera", "Brand Data Owner")]

    # The new brand appears in GET /products.
    new = [p for p in client.get("/api/v1/products").json()["products"] if p["brandId"] == "brand_004"]
    assert [(p["name"], p["brandName"], p["price"], p["factSourceUrl"]) for p in new] == \
        [("Lumen Buds 2", "Lumen Audio", 129.0, "https://www.lumenaudio.example/buds-2")]

    # ... and in a connector/query result when it fits, with only correct claims.
    q = client.post("/api/v1/connector/query", json={"question": "Earbuds under $150?", "assistantId": "ast_01"}).json()
    assert q["recommendation"]["productId"] == new[0]["productId"]
    assert q["claims"] and all(c["status"] == "correct" for c in q["claims"])

    # Duplicate brandName (case-insensitive) -> 409.
    dup = onboard(client, dict(BODY, brandName="  lumen AUDIO "))
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "CONFLICT"
    assert onboard(client, dict(BODY, brandName="kestrel")).status_code == 409  # seeded brands count too

    # 0 products -> 422.
    none = onboard(client, dict(BODY, brandName="Empty Co", products=[]))
    assert none.status_code == 422 and none.json()["error"]["code"] == "VALIDATION_ERROR"

    # Audit entry written.
    entries = client.get("/api/v1/audit", params={"brandId": "brand_004", "targetId": "brand_004"}).json()["entries"]
    assert [(e["action"], e["actor"], e["actorType"]) for e in entries] == [("brand_onboarded", "Sam Rivera", "human")]


def test_is_client_never_in_any_response(client):
    body = onboard(client).json()
    brand = {"brandId": body["brandId"]}
    texts = [json.dumps(body)]
    for path in ["/api/v1/products", "/api/v1/owners", "/api/v1/incidents", "/api/v1/audit", "/api/v1/answers",
                 "/api/v1/visibility/summary", "/api/v1/sources", "/api/v1/metrics/trust", "/api/v1/report",
                 "/api/v1/auth/demo-accounts"]:
        texts.append(client.get(path, params=brand if path != "/api/v1/products" else None).text)
    for path in ["/api/v1/client/report", "/api/v1/client/incidents", "/api/v1/client/visibility"]:
        texts.append(client.get(path, headers={"X-API-Key": body["apiKey"]}).text)
    for text in texts:
        for field in ("isClient", "is_client", "billingTier", "billing_tier", "starter"):
            assert field not in text
    # The flags are stored all the same (contract: isClient true, billingTier "starter").
    with SessionLocal() as db:
        stored = db.scalars(select(Brand).where(Brand.brand_id == body["brandId"])).one()
        assert (stored.is_client, stored.billing_tier) == (True, "starter")


def test_new_brand_works_everywhere(client):
    body = onboard(client).json()
    brand_id, key = body["brandId"], body["apiKey"]
    # brandId use on the dashboard.
    owners = client.get("/api/v1/owners", params={"brandId": brand_id}).json()["owners"]
    assert [o["name"] for o in owners] == ["Sam Rivera"]
    assert len(owners[0]["incidentTypes"]) == 8  # covers every ruleId that creates an incident
    assert client.get("/api/v1/visibility/summary", params={"brandId": brand_id}).json()["brandName"] == "Lumen Audio"
    # Owner key on the client API, scoped to the new brand.
    assert client.get("/api/v1/client/visibility", headers={"X-API-Key": key}).json()["brandId"] == brand_id
    # A mistake about the new product becomes the new brand's incident, owned by its owner.
    run = client.post("/api/v1/checker/run", json={"answerText": "The Lumen Buds 2 costs $99.",
                                                   "assistantId": "ast_02", "queryText": "q"}).json()
    incident = client.get(f"/api/v1/incidents/{run['incidentsCreated'][0]}").json()
    assert incident["ownerName"] == "Sam Rivera"
    listed = client.get("/api/v1/incidents", params={"brandId": brand_id}).json()["incidents"]
    assert [i["incidentId"] for i in listed] == [incident["incidentId"]]
    # A spec the brand did not send is unknown, not invented.
    ram = client.post("/api/v1/checker/run", json={"answerText": "The Lumen Buds 2 has 16 GB of RAM.",
                                                   "assistantId": "ast_02", "queryText": "q"}).json()
    assert [(c["ruleId"], c["status"]) for c in ram["claims"]] == [("NO_FACT", "unverifiable")]


def test_defaults_and_unknown_spec_keys(client):
    body = onboard(client, {"brandName": "Peak Gear", "ownerName": "Ada Moss",
                            "products": [{"name": "Peak Trail 15", "price": 649,
                                          "specs": {"screenInches": 15.6, "waterproof": "IPX4"}}]}).json()
    product = next(p for p in client.get("/api/v1/products").json()["products"] if p["brandId"] == body["brandId"])
    assert (product["availability"], product["currency"], product["returnPolicyDays"], product["factSource"]) == \
        ("in_stock", "USD", 30, "Brand product feed")
    assert product["factSourceUrl"] == "https://www.peakgear.example/trail-15"
    assert product["specs"]["screenInches"] == 15.6 and product["specs"]["ramGb"] is None
    assert product["specs"]["waterproof"] == "IPX4"  # unknown keys are kept as-is


def test_ranking_stays_neutral_with_the_new_brand(client):
    onboard(client)
    question = {"question": "Earbuds under $150?", "assistantId": "ast_01"}
    before = client.post("/api/v1/connector/query", json=question).json()["recommendation"]["productId"]
    with SessionLocal() as db:
        for b in db.scalars(select(Brand)).all():
            b.is_client, b.billing_tier = not b.is_client, "enterprise"
        db.commit()
    assert client.post("/api/v1/connector/query", json=question).json()["recommendation"]["productId"] == before


def test_onboarded_data_resets_on_restart(client):
    onboard(client)
    rebuild_database()
    assert all(p["brandId"] != "brand_004" for p in client.get("/api/v1/products").json()["products"])
    assert onboard(client).status_code == 201  # the name is free again


@pytest.mark.parametrize("change", [
    {"brandName": ""}, {"brandName": "   "}, {"ownerName": ""}, {"brandName": "x" * 101},
    {"products": [{"price": 10}]}, {"products": [{"name": "A"}]}, {"products": [{"name": "A", "price": 0}]},
    {"products": [{"name": "A", "price": -5}]}, {"products": [{"name": "A", "price": "cheap"}]},
    {"products": [{"name": "   ", "price": 10}]}, {"products": [{"name": "A", "price": 10, "availability": "soon"}]},
    {"products": [{"name": "A", "price": 10, "specs": {"ramGb": -1}}]},
    {"products": [{"name": "A", "price": 10, "specs": {"ramGb": "lots"}}]},
    {"products": [{"name": "A", "price": 10, "specs": {"touchscreen": "yes"}}]},
    {"products": [{"name": "A", "price": 10, "factSource": "Rumour"}]},
    {"products": [{"name": "A", "price": 10, "factSourceUrl": "not a url"}]},
    {"products": [{"name": f"P{i}", "price": 10} for i in range(51)]},
    {"products": [{"name": "Twin", "price": 10}, {"name": "twin", "price": 11}]},
    {"products": [{"name": "Kestrel Aero 14", "price": 10}]},
    {"products": "Lumen Buds 2"},
], ids=["empty-brand", "blank-brand", "empty-owner", "long-brand", "no-name", "no-price", "zero-price",
        "negative-price", "text-price", "blank-name", "bad-availability", "negative-spec", "text-spec",
        "text-touchscreen", "bad-fact-source", "bad-url", "51-products", "duplicate-in-request",
        "duplicate-in-catalog", "products-not-a-list"])
def test_validation_is_422(client, change):
    res = onboard(client, dict(BODY, **change))
    assert res.status_code == 422, res.text
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_fifty_products_is_allowed(client):
    res = onboard(client, dict(BODY, products=[{"name": f"Lumen Item {i}", "price": 10 + i} for i in range(50)]))
    assert res.status_code == 201 and res.json()["productsCreated"] == 50
