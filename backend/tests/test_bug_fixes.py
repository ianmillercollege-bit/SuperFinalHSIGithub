"""Regression tests for bugs found in review: each test names the bug it pins down."""

from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from db import Brand, Claim, Product, SessionLocal
from routers import coach as coach_router
from seed_loader import rebuild_database
from services import activity, coach
from services.checker import Catalog, extract_claims
from services.search import LEGACY_MUST_HAVES
from timeutil import today

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"
PASSWORD = "cirqo-demo"
ROSA = "rosa.delgado@bexar-valley-school-district.example"
LAPTOP = {"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01"}


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def auth(client, username) -> dict:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def opt_out(brand_id: str) -> None:
    with SessionLocal() as db:
        db.get(Brand, brand_id).opted_in = False
        db.commit()


def claim_count() -> int:
    with SessionLocal() as db:
        return len(db.scalars(select(Claim)).all())


# ---- checker: every claim in a sentence is stored, not just the first of each type -------------------


def test_every_claim_in_one_sentence_is_stored(client):
    text = ("The Kestrel Aero 14 has 8 GB of RAM and a 256 GB SSD and a fingerprint reader. "
            "It costs $399, down from $449.")
    with SessionLocal() as db:
        expected = len(extract_claims(text, Catalog(db)))
    assert expected >= 4  # two specs, a feature and two prices
    before = claim_count()
    body = {"answerText": text, "assistantId": "ast_02", "queryText": "q"}
    assert client.post("/api/v1/checker/run", json=body).status_code == 200
    assert claim_count() - before == expected
    # Filing the same text again is a new answer with the same claims, each stored once.
    assert client.post("/api/v1/checker/run", json=body).status_code == 200
    assert claim_count() - before == 2 * expected


# ---- onboarding: spec keys the search reads must have the right shape ----------------------------------


def onboard(client, specs: dict, name: str = "Zed Buds 9"):
    return client.post("/api/v1/brands/onboard", json={
        "brandName": f"Brand for {name}", "ownerName": "Pat Lee",
        "products": [{"name": name, "price": 50, "category": "headphones", "specs": specs}]})


def test_onboarding_rejects_spec_lists_of_the_wrong_type(client):
    assert onboard(client, {"useCaseTags": 5}).status_code == 422
    assert onboard(client, {"certifications": [1, 2]}).status_code == 422
    assert onboard(client, {"ports": ["usb"]}).status_code == 422
    assert onboard(client, {"weightG": "heavy"}).status_code == 422


def test_search_survives_odd_but_allowed_specs(client):
    res = onboard(client, {"useCaseTags": None, "certifications": None, "batteryHours": 8, "weightG": 250})
    assert res.status_code == 201, res.text
    search = {"question": "headphones for the gym", "assistantId": "ast_01"}
    assert client.post("/api/v1/connector/search", json=search).status_code == 200
    with_must = {**search, "constraints": {"mustHave": ["gym"]}}
    assert client.post("/api/v1/connector/search", json=with_must).status_code == 200


def test_legacy_must_haves_ignore_non_numeric_specs():
    assert LEGACY_MUST_HAVES["light"]({"weightG": "abc"}) is False
    assert LEGACY_MUST_HAVES["light"]({"weightG": 900}) is True
    assert LEGACY_MUST_HAVES["battery"]({"batteryHours": "12"}) is False


# ---- governance: a sign-in only decides its own company's incidents ------------------------------------


def test_another_companys_login_cannot_approve(seeded):
    body = {"approverName": "Maria Lopez"}
    arcton = auth(seeded, "priya.shah@arcton.example")
    res = seeded.post("/api/v1/incidents/inc_46/approve", json=body, headers=arcton)
    assert res.status_code == 403, res.text
    partner = auth(seeded, ROSA)
    assert seeded.post("/api/v1/incidents/inc_46/approve", json=body, headers=partner).status_code == 403
    assert seeded.get("/api/v1/incidents/inc_46").json()["status"] == "pending_approval"
    kestrel = auth(seeded, "maria.lopez@kestrel.example")
    assert seeded.post("/api/v1/incidents/inc_46/approve", json=body, headers=kestrel).status_code == 200


# ---- coach ----------------------------------------------------------------------------------------------


def test_a_score_drop_is_an_allowed_number():
    allowed = coach.allowed_numbers({"business": {"name": "K"}, "asOf": "2026-09-30",
                                     "visibility": {"score": 55, "previousScore": 62}})
    assert coach._matches(7, allowed)


def test_built_in_answer_about_a_drop_is_verified(client):
    context = {"business": {"name": "Kestrel"}, "asOf": "2026-09-30",
               "visibility": {"score": 55, "previousScore": 62}}
    res = client.post("/api/v1/coach", json={"question": "How is my visibility?", "history": [], "context": context})
    assert res.status_code == 200, res.text
    body = res.json()
    assert "down 7 points" in body["answer"]
    assert body["verified"] is True


def test_wrong_typed_context_sections_are_422(client):
    base = {"business": {"name": "K"}, "asOf": "2026-09-30"}
    for bad in ({"visibility": [1]}, {"claims": 5}, {"weeklyScores": 3}, {"opportunities": {"a": 1}}):
        res = client.post("/api/v1/coach", json={"question": "hi", "history": [], "context": {**base, **bad}})
        assert res.status_code == 422, (bad, res.text)


def test_forwarded_for_trusts_the_address_the_proxy_appended():
    request = SimpleNamespace(headers={"x-forwarded-for": "10.0.0.7, 203.0.113.9"}, client=None)
    assert coach_router._caller(request) == "203.0.113.9"


# ---- activity: the trend keeps moving after UTC midnight --------------------------------------------------


def test_activity_after_midnight_opens_todays_row(client, monkeypatch):
    tomorrow = today() + timedelta(days=1)
    monkeypatch.setattr(activity, "today", lambda: tomorrow)
    res = client.post("/api/v1/checker/run", json={"answerText": "The Kestrel Aero 14 costs $399.",
                                                   "assistantId": "ast_02", "queryText": "q"})
    assert res.status_code == 200, res.text
    daily = client.get("/api/v1/metrics/trust").json()["daily"]
    assert daily[-1]["date"] == tomorrow.isoformat()
    assert daily[-1]["claimsChecked"] == 1 and daily[-1]["incidentsOpened"] == 1
    assert daily[-2]["date"] == today().isoformat()


# ---- auth ----------------------------------------------------------------------------------------------


def test_partner_login_carries_its_org(seeded):
    body = seeded.post("/api/v1/auth/login", json={"username": ROSA, "password": PASSWORD}).json()
    assert body["brand"] is None
    assert body["org"]["orgId"] and body["org"]["orgName"]
    me = seeded.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['token']}"}).json()
    assert me["org"] == body["org"]
    brand_user = seeded.post("/api/v1/auth/login", json={"username": "maria.lopez@kestrel.example",
                                                         "password": PASSWORD}).json()
    assert brand_user["org"] is None and brand_user["brand"]["brandId"] == "brand_001"


def test_logout_with_a_malformed_header_still_succeeds(client):
    res = client.post("/api/v1/auth/logout", headers={"Authorization": "Basic xyz"})
    assert res.status_code == 200 and res.json() == {"ok": True}


def test_partner_can_open_a_public_brand_profile(seeded):
    assert seeded.get("/api/v1/brands/brand_001", headers=auth(seeded, ROSA)).status_code == 200
    arcton = auth(seeded, "priya.shah@arcton.example")
    assert seeded.get("/api/v1/brands/brand_001", headers=arcton).status_code == 403


def test_claiming_a_company_creates_its_login(client):
    opt_out("brand_003")
    res = client.post("/api/v1/brands/brand_003/claim", json={"ownerName": "Dana Okafor", "email": "Dana@novex.example"})
    assert res.status_code == 201, res.text
    login = client.post("/api/v1/auth/login", json={"username": "dana@novex.example", "password": PASSWORD})
    assert login.status_code == 200, login.text
    assert login.json()["brand"]["brandId"] == "brand_003" and login.json()["user"]["role"] == "Brand Data Owner"
    assert any(a["name"] == "Dana Okafor" for a in client.get("/api/v1/brands/brand_003").json()["admins"])
    opt_out("brand_002")
    again = client.post("/api/v1/brands/brand_002/claim", json={"ownerName": "Dana Okafor", "email": "dana@novex.example"})
    assert again.status_code == 409


# ---- connector query: not-opted-in products are never "correct" ------------------------------------------


def test_unverified_alternative_is_labelled_not_called_verified(client):
    first = client.post("/api/v1/connector/query", json=LAPTOP).json()
    alt = first["alternatives"][0]
    with SessionLocal() as db:
        opt_out(db.get(Product, alt["productId"]).brand_id)
    second = client.post("/api/v1/connector/query", json=LAPTOP).json()
    assert second["alternatives"][0]["productId"] == alt["productId"]  # ranking never changes
    assert second["alternatives"][0]["verified"] is False
    assert f"Not CIRQO Verified: another option is the {alt['name']}" in second["answerText"]
    assert f"Another verified option is the {alt['name']}" not in second["answerText"]
    assert not any(c["productId"] == alt["productId"] and c["status"] == "correct" for c in second["claims"])


def test_unverified_pick_has_no_correct_facts_or_claims(client):
    first = client.post("/api/v1/connector/query", json=LAPTOP).json()
    pick = first["recommendation"]["productId"]
    with SessionLocal() as db:
        opt_out(db.get(Product, pick).brand_id)
    second = client.post("/api/v1/connector/query", json=LAPTOP).json()
    assert second["recommendation"]["verified"] is False
    assert second["recommendation"]["facts"] and all(f["claimStatus"] == "unverifiable"
                                                     for f in second["recommendation"]["facts"])
    about_pick = [c for c in second["claims"] if c["productId"] == pick]
    assert about_pick and all(c["status"] == "unverifiable" and c["ruleId"] == "NO_FACT" for c in about_pick)


def test_refurbished_pick_states_its_condition_and_pledge(seeded):
    body = {"question": "Best laptop for school?", "assistantId": "ast_01", "constraints": {"useCase": "school"}}
    winner = seeded.post("/api/v1/connector/query", json=body).json()["recommendation"]["productId"]
    with SessionLocal() as db:
        product = db.get(Product, winner)
        product.condition = "refurbished"
        product.community_pledge = {**(product.community_pledge or {}), "warrantyMonths": 12}
        db.commit()
        name = product.name
    body["constraints"]["includeRefurbished"] = True
    answer = seeded.post("/api/v1/connector/query", json=body).json()
    assert answer["recommendation"]["productId"] == winner
    assert f"The {name} is refurbished." in answer["answerText"]
    assert f"The {name} is covered for 12 months under the brand's community pledge." in answer["answerText"]


# ---- connector: every spelling of a budget counts, and "phone" never returns a tablet ----------------------


def test_budget_is_read_in_every_spelling():
    from routers.connector import price_from_question
    for question in ("phone under $100", "phone under 100$", "phone under 100 dollars", "a phone for 100 bucks",
                     "phone, budget of 100", "phone under 100", "phone up to 100", "cheaper than 100 usd"):
        assert price_from_question(question) == 100, question
    for question in ("laptop under 3 lb", "screen under 15 inches", "battery over 10 hours", "phone under 128 GB",
                     "a phone for school", "under 2 kg", "laptop"):
        assert price_from_question(question) is None, question


def test_search_applies_a_budget_written_after_the_number(seeded):
    for question in ("Find a phone under 100$", "Find a phone under 100 dollars", "Find a phone under 100"):
        body = seeded.post("/api/v1/connector/search", json={"question": question, "assistantId": "ast_01"}).json()
        assert body["optionCount"] == 0, question  # the catalog has no smartphone under $100
    body = seeded.post("/api/v1/connector/search", json={"question": "Find a phone under 200$", "assistantId": "ast_01"}).json()
    assert body["options"] and all(o["price"] <= 200 for o in body["options"])


def test_query_keeps_to_the_named_subcategory(seeded):
    def pick(question):
        res = seeded.post("/api/v1/connector/query", json={"question": question, "assistantId": "ast_01"})
        assert res.status_code == 200, res.text
        with SessionLocal() as db:
            return db.get(Product, res.json()["recommendation"]["productId"]).subcategory
    assert pick("Find a phone under $200") == "Smartphone"
    assert pick("Find a tablet under $100") == "Tablet"
