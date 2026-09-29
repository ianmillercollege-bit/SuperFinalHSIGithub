"""backend/seed/data/ meets every requirement in BACKEND_CONTRACT.md section 9."""

import json
import statistics
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest
from conftest import DEFAULT_ANSWERS, load_mock

from seed_loader import rebuild_database

BACKEND = Path(__file__).resolve().parents[1]
DATA = BACKEND / "seed" / "data"
GENERATOR = BACKEND / "seed" / "generate.py"
FILES = ["brands", "products", "assistants", "sources", "owners", "answers", "claims", "incidents", "audit",
         "daily_metrics"]
RULES = {"PRICE_MISMATCH", "PRICE_OUTDATED", "SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH",
         "POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL", "NO_FACT"}


def rows(name: str, folder: Path = DATA) -> list[dict]:
    data = json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))
    return data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))


@pytest.fixture(scope="module")
def seed() -> dict[str, list[dict]]:
    return {name: rows(name) for name in FILES}


# ---- Section 9, one requirement at a time -------------------------------------------------------


def test_every_decision_17_file_exists():
    assert sorted(p.stem for p in DATA.glob("*.json")) == sorted(FILES)


def test_brands(seed):
    brands = {b["name"]: b for b in seed["brands"]}
    assert set(brands) == {"Kestrel", "Arcton", "Novex"}
    assert brands["Kestrel"]["isClient"] is True
    assert brands["Arcton"]["isClient"] is False and brands["Novex"]["isClient"] is False
    assert all("billingTier" in b for b in seed["brands"])


def test_products(seed):
    products = seed["products"]
    brand = {b["brandId"]: b["name"] for b in seed["brands"]}
    assert len(products) == 12
    assert Counter(brand[p["brandId"]] for p in products) == Counter({"Kestrel": 6, "Arcton": 3, "Novex": 3})
    assert all(329 <= p["price"] <= 699 for p in products)
    assert min(p["price"] for p in products) == 329 and max(p["price"] for p in products) == 699
    assert sum(p["price"] < 500 for p in products) >= 8
    for p in products:
        assert set(p["specs"]) == {"ramGb", "storageGb", "screenInches", "batteryHours", "weightLb", "touchscreen"}
        assert isinstance(p["returnPolicyDays"], int)
        previous = [h["price"] for h in p["priceHistory"] if h["price"] != p["price"]]
        assert previous, f"{p['productId']} needs at least one previous price"


def test_assistants_are_fictional_and_simulated(seed):
    assert [a["name"] for a in seed["assistants"]] == ["Assistant A", "Assistant B", "Assistant C"]
    assert all(a["simulated"] is True for a in seed["assistants"])


def test_sources(seed):
    assert len(seed["sources"]) == 6
    assert {s["type"] for s in seed["sources"]} == {"review_site", "marketplace", "brand_site", "forum", "news"}


def test_owners(seed):
    owners = {o["name"]: (o["role"], set(o["incidentTypes"])) for o in seed["owners"]}
    assert owners == {
        "Maria Lopez": ("Pricing Manager", {"PRICE_MISMATCH", "PRICE_OUTDATED"}),
        "Dev Patel": ("Product Content Lead", {"SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH"}),
        "Grace Kim": ("Legal and Compliance", {"POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL"}),
    }


def test_answers_and_claims(seed):
    assert len(seed["answers"]) >= 30
    assert len(seed["claims"]) >= 90
    assert {c["ruleId"] for c in seed["claims"]} >= RULES  # every ruleId at least once


def test_incidents(seed):
    incidents = seed["incidents"]
    assert len(incidents) >= 20
    assert {i["severity"] for i in incidents} == {"low", "medium", "high", "critical"}
    assert {i["status"] for i in incidents} == {"auto_fixed", "pending_approval", "approved", "rejected",
                                                 "escalated", "resolved"}
    assert sum(i["status"] == "pending_approval" for i in incidents) >= 3
    assert sum(i["status"] == "escalated" for i in incidents) >= 1  # open escalations
    assert sum(i["status"] == "rejected" and i["falseAlarm"] for i in incidents) >= 2


def test_audit_covers_every_incident(seed):
    audited = {e["targetId"] for e in seed["audit"]}
    assert all(i["incidentId"] in audited for i in seed["incidents"])


def test_thirty_day_trend(seed):
    daily = seed["daily_metrics"]
    assert len(daily) == 30
    dates = [d["date"] for d in daily]
    assert dates == sorted(dates) and len(set(dates)) == 30
    last7 = daily[-7:]

    def avg(key, days):
        return statistics.mean(d[key] for d in days)

    # Start and end values ("about" = within 0.03).
    assert abs(daily[0]["accuracyRate"] - 0.62) <= 0.03 and abs(avg("accuracyRate", last7) - 0.91) <= 0.03
    assert abs(daily[0]["hallucinationRate"] - 0.12) <= 0.03 and abs(avg("hallucinationRate", last7) - 0.03) <= 0.03
    assert abs(daily[0]["visibilityRate"] - 0.35) <= 0.03 and abs(avg("visibilityRate", last7) - 0.55) <= 0.03
    # 7-day averages improve every week.
    for key, better in (("accuracyRate", 1), ("hallucinationRate", -1), ("visibilityRate", 1)):
        weeks = [avg(key, daily[end - 7:end]) for end in (9, 16, 23, 30)]
        assert all((b - a) * better > 0 for a, b in zip(weeks, weeks[1:])), (key, weeks)


# ---- Integrity and consistency ------------------------------------------------------------------


def test_references_point_to_real_records(seed):
    ids = {name: {r[key] for r in seed[name]} for name, key in
           (("answers", "answerId"), ("claims", "claimId"), ("products", "productId"), ("sources", "sourceId"),
            ("assistants", "assistantId"), ("incidents", "incidentId"), ("owners", "ownerId"))}
    for a in seed["answers"]:
        assert a["assistantId"] in ids["assistants"] and set(a["sourceIds"]) <= ids["sources"]
    for c in seed["claims"]:
        assert c["answerId"] in ids["answers"] and (c["productId"] is None or c["productId"] in ids["products"])
    for i in seed["incidents"]:
        assert i["claimId"] in ids["claims"] and i["answerId"] in ids["answers"] and i["ownerId"] in ids["owners"]
    targets = ids["incidents"] | ids["claims"] | ids["answers"]
    assert all(e["targetId"] in targets for e in seed["audit"])
    for name, key in (("answers", "answerId"), ("claims", "claimId"), ("incidents", "incidentId")):
        assert len(ids[name]) == len(seed[name]), f"duplicate {key}"
    assert len({e["auditId"] for e in seed["audit"]}) == len(seed["audit"])


def test_consistent_with_shared_mock(seed):
    mock_products = load_mock("products.json")["products"]
    assert [{k: v for k, v in p.items() if k != "brandName"} for p in mock_products] == \
           [{k: v for k, v in p.items() if k != "priceHistory"} for p in seed["products"]]
    assert seed["owners"] == load_mock("owners.json")["owners"]
    assert seed["daily_metrics"] == load_mock("metrics_trust.json")["daily"]
    by_id = {i["incidentId"]: i for i in seed["incidents"]}
    for incident in load_mock("incidents.json")["incidents"]:
        assert by_id[incident["incidentId"]] == incident
    claims = {c["claimId"]: c for c in seed["claims"]}
    for claim in load_mock("claims.json")["claims"]:
        assert claims[claim["claimId"]] == claim


def test_generator_is_deterministic(tmp_path):
    for out in (tmp_path / "a", tmp_path / "b"):
        subprocess.run([sys.executable, str(GENERATOR), "--out", str(out)], check=True, capture_output=True)
    for name in FILES:
        first, second = (tmp_path / "a" / f"{name}.json").read_bytes(), (tmp_path / "b" / f"{name}.json").read_bytes()
        assert first == second, name
        assert first == (DATA / f"{name}.json").read_bytes(), f"{name}.json is stale: rerun generate.py"


# ---- The real server on the real seed -----------------------------------------------------------


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def test_shopper_default_path_has_clear_winner(seeded):
    body = seeded.post("/api/v1/shopper/recommend", json=DEFAULT_ANSWERS).json()
    assert body["recommendation"]["productId"] == "prod_001"
    assert all(a["matchScore"] < body["recommendation"]["matchScore"] for a in body["alternatives"])


def test_shopper_some_path_won_by_competitor(seeded):
    answers = {"answers": [{"questionId": "q_budget", "optionId": "b_700"}, {"questionId": "q_use", "optionId": "u_media"}],
               "swipes": [{"optionId": "s_screen", "liked": True}, {"optionId": "s_touch", "liked": True}]}
    body = seeded.post("/api/v1/shopper/recommend", json=answers).json()
    assert body["recommendation"]["brandName"] in ("Arcton", "Novex")


def test_server_serves_the_seed(seeded):
    assert len(seeded.get("/api/v1/answers?limit=100").json()["answers"]) >= 30
    assert len(seeded.get("/api/v1/incidents?status=pending_approval").json()["incidents"]) >= 3
    trust = seeded.get("/api/v1/metrics/trust?days=30").json()
    assert trust["current"]["accuracyRate"] > trust["daily"][0]["accuracyRate"]
    report = seeded.get("/api/v1/report?days=30").json()
    assert report["incidents"]["total"] >= 20 and report["openHighRisk"]
    # Re-checking a seeded answer finds nothing new: the seed agrees with the checker.
    generated = [a for a in seeded.get("/api/v1/answers?limit=100").json()["answers"] if a["answerId"] < "ans_081"]
    assert len(generated) >= 10
    for a in generated[:10]:
        assert seeded.post("/api/v1/checker/run", json={"answerId": a["answerId"]}).json()["incidentsCreated"] == []
