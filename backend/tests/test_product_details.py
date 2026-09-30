"""The sheet's product-detail columns (added after v1.4.1): camelCased into specs, phones and tablets gain the
checkable RAM, storage, screen and touchscreen specs, and search reads the real ANC column."""

from pathlib import Path

import pytest

from db import Product, SessionLocal
from seed_loader import rebuild_database
from services.checker import Catalog, check, extract_claims
from services.search import boolean_attributes

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def by_category(client, category):
    return client.get("/api/v1/products", params={"category": category}).json()["products"]


def test_detail_columns_are_in_specs(seeded):
    products = [p for c in ("headphones", "laptops", "phones_tablets", "computer_hardware")
                for p in by_category(seeded, c)]
    sheet = [p for p in products if "-" in p["productId"]]
    assert len(sheet) == 1500
    for key in ("productFamily", "model", "generation", "productTier", "msrp", "commercialStatus"):
        assert all(key in p["specs"] for p in sheet), key
    assert {p["specs"]["commercialStatus"] for p in sheet} == {"Active", "Previous generation", "Discontinued"}
    assert all(isinstance(p["specs"]["msrp"], (int, float)) for p in sheet)
    assert all("N/A" not in map(str, p["specs"].values()) for p in sheet)  # N/A columns are left out
    headphones = [p for p in sheet if p["category"] == "headphones"]
    assert all("anc" in p["specs"] for p in headphones)
    phones = [p for p in sheet if p["category"] == "phones_tablets"]
    assert all({"ramGb", "storageGb", "screenInches", "touchscreen"} <= set(p["specs"]) for p in phones)
    assert sum("refreshRateHz" in p["specs"] for p in phones) >= 450  # e-ink tablets have none
    # The 12 original laptops keep exactly their v1.3 specs.
    aero = next(p for p in products if p["productId"] == "prod_001")
    assert set(aero["specs"]) == {"ramGb", "storageGb", "screenInches", "batteryHours", "weightLb", "touchscreen"}


def test_checker_verifies_phone_specs(seeded):
    phone = next(p for p in by_category(seeded, "phones_tablets") if "-" in p["productId"])
    ram = phone["specs"]["ramGb"]
    with SessionLocal() as db:
        catalog = Catalog(db)
        right = [check(c, catalog) for c in extract_claims(f"The {phone['name']} has {ram} GB of RAM.", catalog)]
        wrong = [check(c, catalog) for c in extract_claims(f"The {phone['name']} has {ram + 16} GB of RAM.", catalog)]
    assert [(r.status, r.rule_id) for r in right] == [("correct", None)]
    assert [(r.status, r.rule_id) for r in wrong] == [("incorrect", "SPEC_MISMATCH")]


def test_search_uses_the_anc_column(seeded):
    with SessionLocal() as db:
        headphones = db.query(Product).filter(Product.category == "headphones", Product.product_id.like("%-%")).all()
        for p in headphones:
            expected = not str(p.specs["anc"]).startswith("None")
            assert boolean_attributes(p)["noiseCancelling"] is expected, (p.name, p.specs["anc"])
    body = seeded.post("/api/v1/connector/search", json={"question": "noise cancelling headphones",
                                                         "assistantId": "ast_01",
                                                         "constraints": {"mustHave": ["noiseCancelling"]}}).json()
    assert body["options"]
    with SessionLocal() as db:
        for o in body["options"]:
            assert not str(db.get(Product, o["productId"]).specs["anc"]).startswith("None")
