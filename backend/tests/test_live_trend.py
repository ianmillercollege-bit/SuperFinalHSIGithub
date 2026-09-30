"""Today's trend point moves with real use (services/activity.py)."""

from pathlib import Path

import pytest

from seed_loader import rebuild_database
from timeutil import today

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"


def today_point(client, brand=None):
    params = {"brandId": brand} if brand else {}
    point = client.get("/api/v1/metrics/trust", params=params).json()["daily"][-1]
    assert point["date"] == today().isoformat()
    return point


def file_claim(client, text):
    res = client.post("/api/v1/checker/run", json={"answerText": text, "assistantId": "ast_02", "queryText": "q"})
    assert res.status_code == 200
    return res.json()


def test_a_wrong_claim_moves_todays_point(client):
    before = today_point(client)
    body = file_claim(client, "The Kestrel Aero 14 costs $399.")
    after = today_point(client)
    assert after["claimsChecked"] == before["claimsChecked"] + 1
    assert after["incidentsOpened"] == before["incidentsOpened"] + len(body["incidentsCreated"]) == \
        before["incidentsOpened"] + 1
    assert after["accuracyRate"] < before["accuracyRate"]
    assert after["hallucinationRate"] <= before["hallucinationRate"]  # a price error is not a hallucination


def test_correct_claims_raise_accuracy_and_invented_features_raise_hallucination(client):
    before = today_point(client)
    file_claim(client, "The Kestrel Aero 14 costs $449.99. The Kestrel Aero 14 weighs 2.9 lb.")
    middle = today_point(client)
    assert middle["accuracyRate"] >= before["accuracyRate"] and middle["claimsChecked"] == before["claimsChecked"] + 2
    file_claim(client, "The Kestrel Studio 15 includes a fingerprint reader.")
    after = today_point(client)
    assert after["hallucinationRate"] > middle["hallucinationRate"]


def test_current_metrics_follow_today(client):
    before = client.get("/api/v1/metrics/trust").json()["current"]["accuracyRate"]
    for _ in range(5):
        file_claim(client, "The Kestrel Aero 14 costs $399. The Kestrel Aero 14 has 16 GB of RAM.")
        client.post("/api/v1/checker/run", json={"answerText": f"The Kestrel Pocket 12 is in stock. #{_}",
                                                 "assistantId": "ast_01", "queryText": "q"})
    assert client.get("/api/v1/metrics/trust").json()["current"]["accuracyRate"] < before


def test_rechecking_an_answer_does_not_count_twice(client):
    body = file_claim(client, "The Kestrel Aero 14 costs $399.")
    before = today_point(client)
    client.post("/api/v1/checker/run", json={"answerId": body["answerId"]})
    assert today_point(client) == before


def test_claims_count_for_their_products_brand(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    kestrel, arcton = today_point(client), today_point(client, "brand_002")
    file_claim(client, "The Arcton Swift 14 costs $399.")
    assert today_point(client) == kestrel
    after = today_point(client, "brand_002")
    assert after["claimsChecked"] == arcton["claimsChecked"] + 1
    assert after["incidentsOpened"] == arcton["incidentsOpened"] + 1


def test_brand_without_a_trend_is_fine(client):
    new = client.post("/api/v1/brands/onboard", json={
        "brandName": "Lumen Audio", "ownerName": "Sam Rivera",
        "products": [{"name": "Lumen Buds 2", "price": 129}]}).json()
    body = file_claim(client, "The Lumen Buds 2 costs $99.")
    assert body["incidentsCreated"]
    assert client.get("/api/v1/metrics/trust", params={"brandId": new["brandId"]}).json()["daily"] == []
