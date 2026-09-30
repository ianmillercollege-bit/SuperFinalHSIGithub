"""BACKEND_CONTRACT.md v1.6 section 7e: the Community program (test_community)."""

from pathlib import Path

import pytest
from sqlalchemy import select

from db import CommunityRequest, Product, SessionLocal, User
from seed_loader import rebuild_database
from services.checker import Catalog, check, extract_claims

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"
PASSWORD = "cirqo-demo"
PARTNERS = {"rosa.delgado@bexar-valley-school-district.example": "Bexar Valley School District",
            "marcus.webb@lone-star-veterans-network.example": "Lone Star Veterans Network",
            "tessa.nguyen@bridgeway-community-tech.example": "Bridgeway Community Tech"}
ROSA = "rosa.delgado@bexar-valley-school-district.example"


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def auth(client, username) -> dict:
    res = client.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def owner_of(brand_id: str) -> str:
    with SessionLocal() as db:
        return db.scalars(select(User.username).where(User.brand_id == brand_id, User.role == "Brand Data Owner")
                          .order_by(User.user_id)).first()


def product(client, product_id: str) -> dict:
    with SessionLocal() as db:
        brand_id = db.get(Product, product_id).brand_id
    products = client.get(f"/api/v1/products?brandId={brand_id}").json()["products"]
    return next(p for p in products if p["productId"] == product_id)


def open_item(client, headers, units=4) -> dict:
    """A pledged product with at least `units` still available."""
    items = client.get("/api/v1/community/catalog?limit=100", headers=headers).json()["items"]
    return next(i for i in items if i["communityPledge"]["unitsPledged"] - i["communityPledge"]["unitsPlaced"] >= units)


def request_units(client, headers, item, units=3):
    return client.post("/api/v1/community/requests", headers=headers,
                       json={"productId": item["productId"], "units": units, "purpose": "Laptops for the fall cohort"})


# ---- Seed ------------------------------------------------------------------------------------


def test_seed(seeded):
    with SessionLocal() as db:
        products = db.scalars(select(Product)).all()
        requests = db.scalars(select(CommunityRequest)).all()
        partners = db.scalars(select(User).where(User.role == "Community Partner")).all()
    not_new = [p for p in products if p.condition != "new"]
    pledged = [p for p in products if p.community_pledge]
    assert 0.08 <= len(not_new) / len(products) <= 0.15
    assert len(pledged) >= 150 and all(p.condition in ("refurbished", "surplus") for p in pledged)
    assert {u.username: u.org_id for u in partners}.keys() == PARTNERS.keys()
    # Every brand with pledges has a placed request, and unitsPlaced is exactly its approved requests.
    placed_by_brand = {r.brand_id for r in requests if r.status == "approved"}
    assert {p.brand_id for p in pledged} <= placed_by_brand
    for p in pledged:
        approved = sum(r.units for r in requests if r.product_id == p.product_id and r.status == "approved")
        assert p.community_pledge["unitsPlaced"] == approved <= p.community_pledge["unitsPledged"]
    assert {r.status for r in requests} == {"approved", "pending_approval", "rejected"}


def test_partner_login(seeded):
    for username in PARTNERS:
        res = seeded.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
        assert res.status_code == 200
        assert res.json()["user"]["role"] == "Community Partner" and res.json()["brand"] is None


# ---- Catalog ---------------------------------------------------------------------------------


def test_partner_sees_the_catalog(seeded):
    res = seeded.get("/api/v1/community/catalog?limit=100", headers=auth(seeded, ROSA))
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 100 and len({i["brandId"] for i in items}) > 10  # one catalog across companies
    left = [i["communityPledge"]["unitsPledged"] - i["communityPledge"]["unitsPlaced"] for i in items]
    assert left == sorted(left, reverse=True)  # neutral order: most units available first
    for i in items:
        assert i["condition"] in ("refurbished", "surplus") and i["verified"] is True
        assert set(i["communityPledge"]) == {"unitsPledged", "unitsPlaced", "conditionNotes", "warrantyMonths"}
        assert i["facts"] and all(f["claimStatus"] == "correct" and f["factId"] for f in i["facts"])
        assert any(i["condition"] in f["text"] for f in i["facts"])


def test_catalog_filters(seeded):
    headers = auth(seeded, "grace.kim@cirqo.example")  # CIRQO Staff may browse too
    items = seeded.get("/api/v1/community/catalog?category=headphones&condition=surplus", headers=headers).json()["items"]
    assert items and all(i["category"] == "headphones" and i["condition"] == "surplus" for i in items)
    items = seeded.get("/api/v1/community/catalog?brandId=brand_001", headers=headers).json()["items"]
    assert [i["productId"] for i in items] == ["prod_004"]


def test_catalog_is_not_for_brands_or_guests(seeded):
    assert seeded.get("/api/v1/community/catalog").status_code == 403
    res = seeded.get("/api/v1/community/catalog", headers=auth(seeded, "maria.lopez@kestrel.example"))
    assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN"


# ---- Requests --------------------------------------------------------------------------------


def test_request_then_approve_increments_units_placed(seeded):
    partner = auth(seeded, ROSA)
    item = open_item(seeded, partner)
    before = item["communityPledge"]["unitsPlaced"]
    res = request_units(seeded, partner, item, 3)
    assert res.status_code == 201
    req = res.json()
    assert req["status"] == "pending_approval" and req["requestId"].startswith("creq_")
    assert req["partner"] == {"orgId": "org_01", "orgName": "Bexar Valley School District"}
    assert (req["productId"], req["brandId"], req["units"]) == (item["productId"], item["brandId"], 3)

    owner = auth(seeded, owner_of(item["brandId"]))
    assert req["requestId"] in [r["requestId"] for r in
                                seeded.get("/api/v1/community/requests?status=pending_approval", headers=owner).json()["requests"]]
    res = seeded.post(f"/api/v1/community/requests/{req['requestId']}/approve", headers=owner, json={"note": "Pickup Friday"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "approved" and body["note"] == "Pickup Friday" and body["decidedBy"]
    assert product(seeded, item["productId"])["communityPledge"]["unitsPlaced"] == before + 3

    # 409 on a second approval; audited for the brand.
    again = seeded.post(f"/api/v1/community/requests/{req['requestId']}/approve", headers=owner, json={})
    assert again.status_code == 409 and again.json()["error"]["code"] == "CONFLICT"
    entries = seeded.get("/api/v1/audit?limit=100", headers=owner).json()["entries"]
    actions = {e["action"] for e in entries if e["targetId"] == req["requestId"]}
    assert actions == {"community_request", "community_approved"}


def test_reject_leaves_units_placed(seeded):
    partner = auth(seeded, "marcus.webb@lone-star-veterans-network.example")
    item = open_item(seeded, partner)
    before = item["communityPledge"]["unitsPlaced"]
    req = request_units(seeded, partner, item, 2).json()
    owner = auth(seeded, owner_of(item["brandId"]))
    res = seeded.post(f"/api/v1/community/requests/{req['requestId']}/reject", headers=owner,
                      json={"note": "Committed elsewhere"})
    assert res.status_code == 200 and res.json()["status"] == "rejected"
    assert product(seeded, item["productId"])["communityPledge"]["unitsPlaced"] == before
    assert seeded.post(f"/api/v1/community/requests/{req['requestId']}/approve", headers=owner).status_code == 409


def test_only_the_brands_data_owner_decides(seeded):
    partner = auth(seeded, ROSA)
    item = open_item(seeded, partner)
    req = request_units(seeded, partner, item, 1).json()
    url = f"/api/v1/community/requests/{req['requestId']}/approve"
    other = "brand_001" if item["brandId"] != "brand_001" else "brand_004"
    assert seeded.post(url, headers=auth(seeded, owner_of(other))).status_code == 403
    assert seeded.post(url, headers=partner).status_code == 403
    assert seeded.post(url).status_code == 403
    assert seeded.post("/api/v1/community/requests/creq_999/approve", headers=partner).status_code == 404


def test_request_errors(seeded):
    partner = auth(seeded, ROSA)
    item = open_item(seeded, partner)
    left = item["communityPledge"]["unitsPledged"] - item["communityPledge"]["unitsPlaced"]
    assert request_units(seeded, partner, item, 0).status_code == 422
    too_many = request_units(seeded, partner, item, left + 1)
    assert too_many.status_code == 422 and too_many.json()["error"]["code"] == "VALIDATION_ERROR"
    not_pledged = seeded.post("/api/v1/community/requests", headers=partner,
                              json={"productId": "prod_001", "units": 1, "purpose": "Lab"})
    assert not_pledged.status_code == 403
    unknown = seeded.post("/api/v1/community/requests", headers=partner,
                          json={"productId": "prod_nope", "units": 1, "purpose": "Lab"})
    assert unknown.status_code == 404
    blank = seeded.post("/api/v1/community/requests", headers=partner,
                        json={"productId": item["productId"], "units": 1, "purpose": "  "})
    assert blank.status_code == 422
    # Only partners request units.
    assert request_units(seeded, auth(seeded, "maria.lopez@kestrel.example"), item, 1).status_code == 403
    assert request_units(seeded, {}, item, 1).status_code == 403


def test_request_lists_are_scoped(seeded):
    rosa = seeded.get("/api/v1/community/requests?limit=100", headers=auth(seeded, ROSA)).json()["requests"]
    assert rosa and {r["partner"]["orgId"] for r in rosa} == {"org_01"}
    kestrel = seeded.get("/api/v1/community/requests", headers=auth(seeded, "maria.lopez@kestrel.example")).json()
    assert kestrel["requests"] and {r["brandId"] for r in kestrel["requests"]} == {"brand_001"}
    staff = seeded.get("/api/v1/community/requests?limit=100", headers=auth(seeded, "grace.kim@cirqo.example")).json()
    assert len({r["brandId"] for r in staff["requests"]}) > 1
    assert seeded.get("/api/v1/community/requests").status_code == 403


# ---- Impact ----------------------------------------------------------------------------------


def test_impact_numbers_add_up(seeded):
    brand_id = "brand_001"
    body = seeded.get(f"/api/v1/community/impact?brandId={brand_id}").json()
    products = seeded.get(f"/api/v1/products?brandId={brand_id}").json()["products"]
    pledges = [p["communityPledge"] for p in products if p["communityPledge"]]
    assert body["unitsPledged"] == sum(p["unitsPledged"] for p in pledges) > 0
    assert body["unitsPlaced"] == sum(p["unitsPlaced"] for p in pledges) > 0
    assert body["unitsPledged"] == sum(c["unitsPledged"] for c in body["byCategory"])
    assert body["unitsPlaced"] == sum(c["unitsPlaced"] for c in body["byCategory"])
    staff = auth(seeded, "grace.kim@cirqo.example")
    requests = seeded.get("/api/v1/community/requests?limit=100", headers=staff).json()["requests"]
    mine = [r for r in requests if r["brandId"] == brand_id]
    assert body["requestsPending"] == sum(r["status"] == "pending_approval" for r in mine)
    assert body["partnersServed"] == len({r["partner"]["orgId"] for r in mine if r["status"] == "approved"}) >= 1
    # A brand token decides the brand.
    assert seeded.get("/api/v1/community/impact?brandId=brand_002",
                      headers=auth(seeded, "maria.lopez@kestrel.example")).json()["brandId"] == brand_id
    assert seeded.get("/api/v1/community/impact?brandId=brand_999").status_code == 404


# ---- Checker and connector -------------------------------------------------------------------


def test_condition_claims_are_checked_like_any_spec(seeded):
    with SessionLocal() as db:
        catalog = Catalog(db)
        warranty = db.get(Product, "prod_004").community_pledge["warrantyMonths"]
        results = {c.text: check(c, catalog) for c in extract_claims(
            "The Kestrel Studio 15 is refurbished. The Kestrel Aero 14 is refurbished. "
            f"The Kestrel Studio 15 is covered for {warranty} months under the brand's community pledge. "
            f"The Kestrel Studio 15 is covered for {warranty + 30} months under the brand's community pledge. "
            "The Kestrel Studio 15 comes with a 12-month warranty.", catalog)}
    statuses = [(r.status, r.rule_id) for r in results.values()]
    assert statuses == [("correct", None), ("incorrect", "SPEC_MISMATCH"), ("correct", None),
                        ("incorrect", "SPEC_MISMATCH"), ("unverifiable", "SAFETY_LEGAL")]  # DECISIONS.md #8 holds


def top_pick(client, include: bool | None) -> dict:
    constraints = {"useCase": "school"} if include is None else {"useCase": "school", "includeRefurbished": include}
    res = client.post("/api/v1/connector/query", json={"question": "Best laptop for school?", "assistantId": "ast_01",
                                                       "constraints": constraints})
    assert res.status_code == 200, res.text
    return res.json()


def test_include_refurbished_gates_the_connector(seeded):
    winner = top_pick(seeded, None)["recommendation"]["productId"]
    with SessionLocal() as db:  # make the default winner a refurbished unit
        db.get(Product, winner).condition = "refurbished"
        db.commit()
    for include in (None, False):
        body = top_pick(seeded, include)
        returned = [body["recommendation"]["productId"]] + [a["productId"] for a in body["alternatives"]]
        assert winner not in returned
    assert top_pick(seeded, True)["recommendation"]["productId"] == winner
    bad = seeded.post("/api/v1/connector/query", json={"question": "Laptop?", "assistantId": "ast_01",
                                                       "constraints": {"includeRefurbished": "maybe"}})
    assert bad.status_code == 422
    # The gate is per request: other endpoints still see every product.
    assert any(p["productId"] == winner for p in seeded.get("/api/v1/products?category=laptops").json()["products"])


# ---- shared/mock/community_*.json ------------------------------------------------------------


def test_mocks_match_the_real_shapes(seeded):
    from conftest import load_mock
    from test_contract_shapes import same_shape

    partner, owner = auth(seeded, ROSA), auth(seeded, "maria.lopez@kestrel.example")
    same_shape(seeded.get("/api/v1/community/catalog", headers=partner).json(), load_mock("community_catalog.json"))
    created = request_units(seeded, partner, {"productId": "prod_004"}, 2).json()
    same_shape(created, load_mock("community_request.json"))
    same_shape(seeded.get("/api/v1/community/requests", headers=owner).json(), load_mock("community_requests.json"))
    approved = seeded.post(f"/api/v1/community/requests/{created['requestId']}/approve", headers=owner, json={"note": "Ok"})
    same_shape(approved.json(), load_mock("community_request_approve.json"))
    again = request_units(seeded, partner, {"productId": "prod_004"}, 1).json()
    rejected = seeded.post(f"/api/v1/community/requests/{again['requestId']}/reject", headers=owner, json={"note": "No"})
    same_shape(rejected.json(), load_mock("community_request_reject.json"))
    same_shape(seeded.get("/api/v1/community/impact").json(), load_mock("community_impact.json"))
