"""GET /api/v1/products, /api/v1/owners and /api/v1/shopper/questions (BACKEND_CONTRACT.md section 7)."""

from conftest import load_mock

PRODUCT_KEYS = {"productId", "brandId", "brandName", "name", "price", "currency", "availability", "specs",
                "returnPolicyDays", "updatedAt"}
SPEC_KEYS = {"ramGb", "storageGb", "screenInches", "batteryHours", "weightLb", "touchscreen"}
INCIDENT_RULES = {"PRICE_MISMATCH", "PRICE_OUTDATED", "SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH",
                  "POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL"}


def test_products(client):
    res = client.get("/api/v1/products")
    assert res.status_code == 200
    products = res.json()["products"]
    assert len(products) == 12  # all brands
    assert [p["productId"] for p in products] == sorted(p["productId"] for p in products)
    for p in products:
        assert set(p) == PRODUCT_KEYS and set(p["specs"]) == SPEC_KEYS  # no isClient / billingTier / priceHistory
        assert p["currency"] == "USD" and p["availability"] in ("in_stock", "low_stock", "out_of_stock")
    assert {p["brandName"] for p in products} == {"Kestrel", "Arcton", "Novex"}


def test_owners(client):
    res = client.get("/api/v1/owners")
    assert res.status_code == 200
    owners = res.json()["owners"]
    assert [(o["name"], o["role"]) for o in owners] == [
        ("Maria Lopez", "Pricing Manager"), ("Dev Patel", "Product Content Lead"),
        ("Grace Kim", "Legal and Compliance")]
    # Together they cover every ruleId that can create an incident, each exactly once.
    types = [t for o in owners for t in o["incidentTypes"]]
    assert sorted(types) == sorted(INCIDENT_RULES)


def test_shopper_questions(client):
    res = client.get("/api/v1/shopper/questions")
    assert res.status_code == 200
    # Word for word what the contract (and shared/mock) shows.
    assert res.json() == load_mock("shopper_questions.json")


def test_catalog_endpoints_are_read_only(client):
    for path in ("/api/v1/products", "/api/v1/owners", "/api/v1/shopper/questions"):
        assert client.post(path).json()["error"]["code"] == "BAD_REQUEST"
