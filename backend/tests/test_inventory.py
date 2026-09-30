"""Inventory (v1.9): a brand reads and edits its own products; nobody else can."""

from pathlib import Path

import pytest

from seed_loader import rebuild_database

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


OWNER = {"X-API-Key": "fd_demo_owner_2026"}          # Kestrel (brand_001)
VIEWER = {"X-API-Key": "fd_demo_viewer_2026"}
ARCTON = {"X-API-Key": "fd_demo_arcton_2026"}        # brand_002


def first_product(client, brand="brand_001"):
    return client.get("/api/v1/inventory", params={"brandId": brand, "limit": 1}).json()["items"][0]


def test_list_is_paged_filtered_and_summarised(client):
    res = client.get("/api/v1/inventory", params={"brandId": "brand_001", "limit": 5})
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 5 and body["total"] == body["summary"]["total"]
    assert all(p["brandId"] == "brand_001" for p in body["items"])
    s = body["summary"]
    assert s["inStock"] + s["lowStock"] + s["outOfStock"] == s["total"]
    assert sum(s["byCategory"].values()) == s["total"]
    name = body["items"][0]["name"]
    found = client.get("/api/v1/inventory", params={"brandId": "brand_001", "q": name.upper()}).json()
    assert found["total"] >= 1 and all(name.lower() in p["name"].lower() for p in found["items"])
    page2 = client.get("/api/v1/inventory", params={"brandId": "brand_001", "limit": 5, "offset": 5}).json()
    assert {p["productId"] for p in page2["items"]}.isdisjoint({p["productId"] for p in body["items"]})


def test_edit_price_and_stock_reaches_the_verified_catalog_and_audit_log(client):
    p = first_product(client)
    res = client.patch(f"/api/v1/inventory/{p['productId']}", headers=OWNER,
                       json={"price": p["price"] + 10, "availability": "out_of_stock", "specs": {"batteryHours": 9}})
    assert res.status_code == 200
    out = res.json()
    assert out["price"] == p["price"] + 10 and out["availability"] == "out_of_stock" and out["specs"]["batteryHours"] == 9
    assert client.get(f"/api/v1/products/{p['productId']}").json()["price"] == p["price"] + 10
    log = client.get("/api/v1/audit", params={"brandId": "brand_001", "targetId": p["productId"]}).json()["entries"]
    assert log and log[0]["action"] == "inventory_updated"


def test_writes_need_the_brands_own_owner_key(client):
    p = first_product(client)
    body = {"price": 1.0}
    url = f"/api/v1/inventory/{p['productId']}"
    assert client.patch(url, json=body).status_code == 401
    assert client.patch(url, json=body, headers=VIEWER).status_code == 403
    assert client.patch(url, json=body, headers=ARCTON).status_code == 404  # another brand's product
    assert client.delete(url, headers=ARCTON).status_code == 404
    assert client.get(f"/api/v1/products/{p['productId']}").json()["price"] == p["price"]


def test_patch_validation(client):
    p = first_product(client)
    url = f"/api/v1/inventory/{p['productId']}"
    for bad in ({}, {"price": 0}, {"price": -5}, {"availability": "maybe"}, {"specs": {"batteryHours": "lots"}}):
        assert client.patch(url, json=bad, headers=OWNER).status_code == 422, bad


def test_delete(client):
    p = first_product(client)
    assert client.delete(f"/api/v1/inventory/{p['productId']}", headers=OWNER).status_code == 204
    assert client.get(f"/api/v1/products/{p['productId']}").status_code == 404


def test_import_adds_updates_and_skips_other_brands(client):
    p = first_product(client)
    other = first_product(client, "brand_002")
    before = client.get("/api/v1/inventory", params={"brandId": "brand_001"}).json()["summary"]["total"]
    rows = [{"name": p["name"].lower(), "price": p["price"] + 1, "availability": "low_stock"},
            {"name": "Kestrel Brand New Thing", "price": 55, "category": "headphones"},
            {"name": "Kestrel Brand New Thing", "price": 99},            # listed twice: first row wins
            {"name": other["name"], "price": 5}]                        # belongs to Arcton
    res = client.post("/api/v1/inventory/import", headers=OWNER, json={"products": rows})
    assert res.status_code == 200, res.text
    assert res.json() == {"created": 1, "updated": 1, "skipped": [other["name"]], "total": before + 1}
    new = client.get("/api/v1/inventory", params={"brandId": "brand_001", "q": "brand new thing"}).json()["items"][0]
    assert new["price"] == 55 and new["category"] == "headphones"
    assert client.get(f"/api/v1/products/{p['productId']}").json()["availability"] == "low_stock"


def test_import_has_no_cap_and_needs_a_key(client):
    rows = [{"name": f"Bulk Item {i}", "price": 10 + i} for i in range(700)]
    assert client.post("/api/v1/inventory/import", json={"products": rows}).status_code == 401
    res = client.post("/api/v1/inventory/import", headers=OWNER, json={"products": rows})
    assert res.status_code == 200 and res.json()["created"] == 700
    assert client.post("/api/v1/inventory/import", headers=OWNER, json={"products": []}).status_code == 422


def test_staff_see_every_company_and_a_brand_login_only_its_own(seeded):
    def token(username):
        res = seeded.post("/api/v1/auth/login", json={"username": username, "password": "cirqo-demo"})
        assert res.status_code == 200, res.text
        return {"Authorization": f"Bearer {res.json()['token']}"}

    own = seeded.get("/api/v1/inventory", headers=token("priya.shah@arcton.example"), params={"limit": 200}).json()
    assert own["items"] and {p["brandId"] for p in own["items"]} == {"brand_002"}
    staff = seeded.get("/api/v1/inventory", headers=token("grace.kim@cirqo.example"), params={"limit": 200}).json()
    assert len({p["brandId"] for p in staff["items"]}) > 1 and staff["total"] == staff["summary"]["total"] > 1000
    assert seeded.get("/api/v1/inventory", params={"limit": 200}).json()["items"][0]["brandId"] == "brand_001"  # no login: default brand
    assert seeded.get("/api/v1/inventory", params={"brandId": "brand_999"}).status_code == 404
