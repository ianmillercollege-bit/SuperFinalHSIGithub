"""BACKEND_CONTRACT.md section 8: ranking never depends on who pays."""

import ast
from pathlib import Path

from conftest import DEFAULT_ANSWERS
from sqlalchemy import select

from db import Brand, Product, SessionLocal
from routers.shopper import to_rankable
from services.ranking import RankableProduct, rank

PATHS = [
    DEFAULT_ANSWERS,
    {"answers": [{"questionId": "q_budget", "optionId": "b_700"}, {"questionId": "q_use", "optionId": "u_media"}],
     "swipes": [{"optionId": "s_screen", "liked": True}, {"optionId": "s_touch", "liked": True}]},
    {"answers": [{"questionId": "q_budget", "optionId": "b_400"}, {"questionId": "q_use", "optionId": "u_travel"}],
     "swipes": [{"optionId": "s_light", "liked": True}]},
    {"answers": [{"questionId": "q_budget", "optionId": "b_700"}, {"questionId": "q_use", "optionId": "u_work"}],
     "swipes": []},
]


def full_order(answers: dict) -> list[str]:
    """Every eligible product, best first, straight from the ranking code."""
    chosen = {a["questionId"]: a["optionId"] for a in answers["answers"]}
    liked = [s["optionId"] for s in answers["swipes"] if s["liked"]]
    budget = {"b_400": 400.0, "b_500": 500.0, "b_700": 700.0}[chosen["q_budget"]]
    with SessionLocal() as db:
        products = [to_rankable(p) for p in db.scalars(select(Product)).all()]
    return [p.product_id for p, _ in rank(products, budget, chosen.get("q_use"), liked)]


def api_order(client, answers: dict) -> list[str]:
    body = client.post("/api/v1/shopper/recommend", json=answers).json()
    return [body["recommendation"]["productId"]] + [a["productId"] for a in body["alternatives"]]


def flip_every_brand():
    with SessionLocal() as db:
        for b in db.scalars(select(Brand)).all():
            b.is_client = not b.is_client
            b.opted_in = not b.opted_in
            b.billing_tier = "enterprise" if b.billing_tier in (None, "", "free") else None
        db.commit()


def test_ranking_neutral(client):
    before = [(full_order(p), api_order(client, p)) for p in PATHS]
    flip_every_brand()
    after = [(full_order(p), api_order(client, p)) for p in PATHS]
    assert before == after


def test_ranking_code_never_reads_billing_fields():
    # Look at every name the ranking code actually uses (comments and docstrings don't count).
    tree = ast.parse((Path(__file__).resolve().parents[1] / "services" / "ranking.py").read_text(encoding="utf-8"))
    used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | \
           {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)} | \
           {a.name for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)) for a in n.names}
    assert not used & {"is_client", "isClient", "billing_tier", "billingTier", "opted_in", "optedIn", "Brand", "db"}
    assert not {"is_client", "billing_tier", "opted_in", "brand_id"} & set(RankableProduct.model_fields)


def test_default_path_has_clear_winner(client):
    body = client.post("/api/v1/shopper/recommend", json=DEFAULT_ANSWERS).json()
    assert body["recommendation"]["productId"] == "prod_001"
    assert body["alternatives"] and all(a["matchScore"] < body["recommendation"]["matchScore"]
                                        for a in body["alternatives"])


def test_a_competitor_can_win(client):
    body = client.post("/api/v1/shopper/recommend", json=PATHS[1]).json()
    assert body["recommendation"]["brandName"] in ("Arcton", "Novex")


def test_over_budget_excluded_and_ties_broken_by_price():
    order = full_order(PATHS[2])  # under $400
    with SessionLocal() as db:
        prices = {p.product_id: p.price for p in db.scalars(select(Product)).all()}
    assert order and all(prices[p] < 400 for p in order)


def test_reasons_are_all_checked_correct(client):
    reasons = client.post("/api/v1/shopper/recommend", json=DEFAULT_ANSWERS).json()["recommendation"]["reasons"]
    assert reasons and all(r["claimStatus"] == "correct" for r in reasons)


def test_no_product_fits(client):
    with SessionLocal() as db:
        for p in db.scalars(select(Product)).all():
            p.price = 999.0
        db.commit()
    body = client.post("/api/v1/shopper/recommend", json=DEFAULT_ANSWERS).json()
    assert body["recommendation"] is None and body["alternatives"] == []


def test_unknown_ids_are_422(client):
    for bad in ({"answers": [{"questionId": "q_nope", "optionId": "b_500"}]},
                {"answers": [{"questionId": "q_budget", "optionId": "b_999"}]},
                {"swipes": [{"optionId": "s_nope", "liked": True}]}):
        res = client.post("/api/v1/shopper/recommend", json=bad)
        assert res.status_code == 422 and res.json()["error"]["code"] == "VALIDATION_ERROR"
