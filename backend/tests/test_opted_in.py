"""v1.5 section 7d: opted-in vs not-opted-in brands. The fixture brands all start opted in."""
from sqlalchemy import select

from db import Brand, Product, SessionLocal

GYM = {"question": "I want headphones for the gym, budget around $150", "assistantId": "ast_01"}


def opt_out(brand_id: str) -> None:
    with SessionLocal() as db:
        db.get(Brand, brand_id).opted_in = False
        db.commit()


def test_products_carry_verified_and_filter(client):
    assert all(p["verified"] is True for p in client.get("/api/v1/products").json()["products"])
    opt_out("brand_002")
    products = client.get("/api/v1/products").json()["products"]
    assert {p["verified"] for p in products if p["brandId"] == "brand_002"} == {False}
    assert {p["verified"] for p in products if p["brandId"] != "brand_002"} == {True}
    only_out = client.get("/api/v1/products?optedIn=false").json()["products"]
    assert only_out and {p["brandId"] for p in only_out} == {"brand_002"}
    assert "brand_002" not in {p["brandId"] for p in client.get("/api/v1/products?optedIn=true").json()["products"]}


def test_profile_and_demo_accounts_show_opted_in(client):
    assert client.get("/api/v1/brands/brand_002").json()["optedIn"] is True
    assert any(a["brandId"] == "brand_002" for a in client.get("/api/v1/auth/demo-accounts").json()["accounts"])
    opt_out("brand_002")
    assert client.get("/api/v1/brands/brand_002").json()["optedIn"] is False
    accounts = client.get("/api/v1/auth/demo-accounts").json()["accounts"]
    assert accounts and all(a["brandId"] != "brand_002" and a["optedIn"] is True for a in accounts)


def test_query_labels_an_unverified_pick(client):
    body = {"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01"}
    first = client.post("/api/v1/connector/query", json=body).json()
    assert first["recommendation"]["verified"] is True and first["unverifiedCount"] == 0
    with SessionLocal() as db:
        brand_id = db.get(Product, first["recommendation"]["productId"]).brand_id
    opt_out(brand_id)
    second = client.post("/api/v1/connector/query", json=body).json()
    assert second["recommendation"]["productId"] == first["recommendation"]["productId"]  # ranking unchanged
    assert second["recommendation"]["verified"] is False and second["unverifiedCount"] >= 1
    assert second["answerText"].startswith("Not verified by the brand:")


def test_claim_company_opts_in(client):
    opt_out("brand_003")
    assert client.get("/api/v1/brands/brand_003").json()["optedIn"] is False
    res = client.post("/api/v1/brands/brand_003/claim", json={"ownerName": "Dana Okafor", "email": "dana@novex.example"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["optedIn"] is True and body["apiKey"].startswith("fd_") and body["owners"][0]["role"] == "Brand Data Owner"
    assert client.get("/api/v1/brands/brand_003").json()["optedIn"] is True
    products = client.get("/api/v1/products?brandId=brand_003").json()["products"]
    assert products and all(p["verified"] is True and p["factSource"] == "Brand product feed" for p in products)
    again = client.post("/api/v1/brands/brand_003/claim", json={"ownerName": "Dana Okafor", "email": "dana@novex.example"})
    assert again.status_code == 409 and again.json()["error"]["code"] == "CONFLICT"
    entries = client.get("/api/v1/audit?brandId=brand_003&targetId=brand_003").json()["entries"]
    assert any(e["action"] == "brand_claimed" for e in entries)
    # The new key works on the client API, scoped to Novex.
    assert client.get("/api/v1/client/visibility", headers={"X-API-Key": body["apiKey"]}).status_code == 200


def test_product_detail_has_comparisons_shape(client):
    pid = client.get("/api/v1/products").json()["products"][0]["productId"]
    detail = client.get(f"/api/v1/products/{pid}").json()
    assert detail["productId"] == pid and "comparisons" in detail and "verified" in detail
    assert client.get("/api/v1/products/prod_nope").status_code == 404
