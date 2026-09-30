"""GET /api/v1/products, /api/v1/owners and /api/v1/shopper/questions (BACKEND_CONTRACT.md section 7)."""

from conftest import load_mock

PRODUCT_KEYS = {"productId", "brandId", "brandName", "name", "price", "currency", "availability", "specs",
                "returnPolicyDays", "updatedAt", "factSource", "factSourceUrl", "verifiedAt",  # v1.2
                "category", "subcategory"}  # v1.4.1
FACT_SOURCES = {"Brand product feed", "Brand website", "Manufacturer spec sheet"}
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


def test_products_verified_data_layer(client):
    """Contract v1.2: factSource, factSourceUrl (fictional .example domain) and verifiedAt on every product."""
    import re
    from urllib.parse import urlparse

    for p in client.get("/api/v1/products").json()["products"]:
        assert p["factSource"] in FACT_SOURCES
        url = urlparse(p["factSourceUrl"])
        assert url.scheme == "https" and url.hostname.endswith(".example"), p["factSourceUrl"]
        assert p["brandName"].lower() in url.hostname  # the brand's own page
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", p["verifiedAt"])
        assert p["verifiedAt"] >= p["updatedAt"]  # verified no earlier than the last change
    aero = next(p for p in client.get("/api/v1/products").json()["products"] if p["productId"] == "prod_001")
    assert (aero["factSource"], aero["factSourceUrl"]) == ("Brand product feed", "https://www.kestrel.example/aero-14")


def test_recommendations_report_when_facts_were_verified(client):
    from conftest import DEFAULT_ANSWERS

    verified = {p["productId"]: p["verifiedAt"] for p in client.get("/api/v1/products").json()["products"]}
    shopper = client.post("/api/v1/shopper/recommend", json=DEFAULT_ANSWERS).json()["recommendation"]
    assert shopper["verifiedAt"] == verified[shopper["productId"]]
    connector = client.post("/api/v1/connector/query", json={
        "question": "Best laptop under $500?", "assistantId": "ast_01",
        "constraints": {"useCase": "school", "mustHave": ["battery", "light"]}}).json()["recommendation"]
    assert connector["verifiedAt"] == verified[connector["productId"]]


def test_owners(client):
    res = client.get("/api/v1/owners")
    assert res.status_code == 200
    owners = res.json()["owners"]
    assert [(o["name"], o["role"]) for o in owners] == [
        ("Maria Lopez", "Brand Data Owner"), ("Dev Patel", "CIRQO Product Owner"),
        ("Grace Kim", "CIRQO Trust and Safety Lead")]  # business plan 5.1 roles
    assert owners[1]["incidentTypes"] == []  # the Product Owner owns rule and model changes, not incidents
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
