"""BACKEND_CONTRACT.md v1.3 section 7b: brand accounts (test_brand_scope), on the real seed."""

import json
import statistics
import subprocess
import sys
from pathlib import Path

import pytest

from seed_loader import rebuild_database

BACKEND = Path(__file__).resolve().parents[1]
DATA = BACKEND / "seed" / "data"
SCOPED = ["/api/v1/visibility/summary", "/api/v1/answers", "/api/v1/sources", "/api/v1/claims", "/api/v1/incidents",
          "/api/v1/owners", "/api/v1/audit", "/api/v1/metrics/trust", "/api/v1/report"]
KEYS = {"brand_001": "fd_demo_owner_2026", "brand_002": "fd_demo_arcton_2026", "brand_003": "fd_demo_novex_2026"}


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def get(c, path, brand=None, **params):
    if brand:
        params["brandId"] = brand
    res = c.get(path, params=params)
    assert res.status_code == 200, (path, brand, res.text[:200])
    return res.json()


def without_clock(body):
    return {k: v for k, v in body.items() if k != "generatedAt"}


# ---- The three cases the contract names ---------------------------------------------------------


def test_brand_scope(seeded):
    # Arcton's view shows Arcton's incidents only, and lists Kestrel as a competitor.
    products = {p["productId"]: p["brandId"] for p in get(seeded, "/api/v1/products")["products"]}
    arcton = get(seeded, "/api/v1/incidents", "brand_002", limit=100)["incidents"]
    assert arcton and all(products[i["productId"]] == "brand_002" for i in arcton)
    assert {i["ownerName"] for i in arcton} <= {"Priya Shah", "Tom Becker"}
    visibility = get(seeded, "/api/v1/visibility/summary", "brand_002")
    assert (visibility["brandId"], visibility["brandName"]) == ("brand_002", "Arcton")
    assert [c["brandName"] for c in visibility["competitors"]] == ["Kestrel", "Novex"]

    # Unknown brandId -> 404 NOT_FOUND on every scoped endpoint.
    for path in SCOPED:
        res = seeded.get(path, params={"brandId": "brand_999"})
        assert res.status_code == 404, path
        assert res.json() == {"error": {"code": "NOT_FOUND", "message": "Brand brand_999 does not exist."}}

    # Default equals Kestrel.
    for path in SCOPED:
        assert without_clock(get(seeded, path)) == without_clock(get(seeded, path, "brand_001")), path
    assert get(seeded, "/api/v1/visibility/summary")["brandName"] == "Kestrel"


# ---- Each endpoint is really scoped -------------------------------------------------------------


def test_every_brand_sees_only_its_own_records(seeded):
    seen = {}
    for brand in KEYS:
        incidents = {i["incidentId"] for i in get(seeded, "/api/v1/incidents", brand, limit=100)["incidents"]}
        owners = {o["ownerId"] for o in get(seeded, "/api/v1/owners", brand)["owners"]}
        answers = {a["answerId"] for a in get(seeded, "/api/v1/answers", brand, limit=100)["answers"]}
        seen[brand] = incidents, owners, answers
        assert incidents and owners and answers
    for a in KEYS:
        for b in KEYS:
            if a < b:
                for mine, theirs in zip(seen[a], seen[b]):
                    assert not mine & theirs, (a, b)  # nothing shared between brands in the seed
    assert {o["name"] for o in get(seeded, "/api/v1/owners", "brand_003")["owners"]} == {"Lena Ortiz", "Marcus Webb"}


def test_answers_and_claims_follow_the_brand(seeded):
    answers = get(seeded, "/api/v1/answers", "brand_002", limit=100)["answers"]
    assert all(a["answerId"].startswith("ans_2") for a in answers)
    # Arcton's tracked prompts: most answers name Arcton (rank >= 1), some name only other brands (rank null).
    assert all((a["rank"] or 0) >= 1 if a["brandMentioned"] else a["rank"] is None for a in answers)
    share = sum(a["brandMentioned"] for a in answers) / len(answers)
    assert 0.4 <= share <= 0.8  # realistic, not ~100%
    ids = {a["answerId"] for a in answers}
    claims = get(seeded, "/api/v1/claims", "brand_002", limit=100)["claims"]
    assert claims and all(c["answerId"] in ids for c in claims)


def test_visibility_matches_each_brands_trend(seeded):
    for brand in KEYS:
        visibility = get(seeded, "/api/v1/visibility/summary", brand)["visibilityRate"]
        trend_end = get(seeded, "/api/v1/metrics/trust", brand)["current"]["visibilityRate"]
        assert abs(visibility - trend_end) <= 0.1, (brand, visibility, trend_end)


def test_audit_follows_the_brand(seeded):
    arcton_incidents = {i["incidentId"] for i in get(seeded, "/api/v1/incidents", "brand_002", limit=100)["incidents"]}
    kestrel_audit = get(seeded, "/api/v1/audit", limit=100)["entries"]
    assert not arcton_incidents & {e["targetId"] for e in kestrel_audit}
    arcton_audit = get(seeded, "/api/v1/audit", "brand_002", limit=100)["entries"]
    assert any(e["targetId"] in arcton_incidents for e in arcton_audit)
    humans = {e["actor"] for e in arcton_audit if e["actorType"] == "human"}
    assert humans and humans <= {"Priya Shah", "Tom Becker"}


def test_each_brand_has_its_own_improving_trend(seeded):
    trends = {b: get(seeded, "/api/v1/metrics/trust", b) for b in KEYS}
    for brand, trust in trends.items():
        daily = trust["daily"]
        assert len(daily) == 30
        weeks = [statistics.mean(d["accuracyRate"] for d in daily[e - 7:e]) for e in (9, 16, 23, 30)]
        assert all(b > a for a, b in zip(weeks, weeks[1:])), brand
    starts = {b: t["daily"][0]["accuracyRate"] for b, t in trends.items()}
    ends = {b: t["current"]["accuracyRate"] for b, t in trends.items()}
    assert len(set(starts.values())) == 3 and len(set(ends.values())) == 3  # different from Kestrel's
    report = get(seeded, "/api/v1/report", "brand_003")
    assert report["brandName"] == "Novex" and report["impact"]["accuracyStart"] == starts["brand_003"]
    assert {o["name"] for o in report["governance"]["owners"]} == {"Lena Ortiz", "Marcus Webb"}


def test_brand_neutral_answers_are_seen_by_every_brand(seeded):
    body = seeded.post("/api/v1/connector/query", json={
        "question": "Big touchscreen laptop under $700 for movies?", "assistantId": "ast_01",
        "constraints": {"useCase": "media", "mustHave": ["screen", "touch"]}}).json()
    for brand in KEYS:
        answer = next(a for a in get(seeded, "/api/v1/answers", brand, limit=100)["answers"]
                      if a["answerId"] == body["answerId"])
        # brandMentioned and rank are computed for the brand being viewed.
        mentioned = brand in {"brand_001": "Kestrel", "brand_002": "Arcton", "brand_003": "Novex"} and \
            {"brand_001": "Kestrel", "brand_002": "Arcton", "brand_003": "Novex"}[brand] in body["answerText"]
        assert answer["brandMentioned"] == mentioned, brand


def test_checker_incident_goes_to_the_product_brand(seeded):
    body = seeded.post("/api/v1/checker/run", json={
        "answerText": "The Arcton Swift 14 includes a fingerprint reader.", "assistantId": "ast_02",
        "queryText": "q"}).json()
    incident = seeded.get(f"/api/v1/incidents/{body['incidentsCreated'][0]}").json()
    assert incident["ownerName"] == "Tom Becker"  # Arcton's Trust and Safety Lead
    arcton = {i["incidentId"] for i in get(seeded, "/api/v1/incidents", "brand_002", limit=100)["incidents"]}
    kestrel = {i["incidentId"] for i in get(seeded, "/api/v1/incidents", limit=100)["incidents"]}
    assert incident["incidentId"] in arcton and incident["incidentId"] not in kestrel
    # Arcton's owner decides it; approvals need no brandId.
    ok = seeded.post(f"/api/v1/incidents/{incident['incidentId']}/approve", json={"approverName": "Tom Becker"})
    assert ok.status_code == 200
    audit = get(seeded, "/api/v1/audit", "brand_002", targetId=incident["incidentId"])["entries"]
    assert audit[0]["action"] == "approved"


# ---- Demo accounts and brand-scoped client keys ------------------------------------------------


def test_demo_accounts(seeded):
    body = seeded.get("/api/v1/auth/demo-accounts").json()
    assert body == {"accounts": [
        {"brandId": "brand_001", "brandName": "Kestrel", "role": "owner", "apiKey": "fd_demo_owner_2026"},
        {"brandId": "brand_001", "brandName": "Kestrel", "role": "viewer", "apiKey": "fd_demo_viewer_2026"},
        {"brandId": "brand_002", "brandName": "Arcton", "role": "owner", "apiKey": "fd_demo_arcton_2026"},
        {"brandId": "brand_003", "brandName": "Novex", "role": "owner", "apiKey": "fd_demo_novex_2026"}]}
    assert "isClient" not in json.dumps(body) and "billingTier" not in json.dumps(body)


def test_client_keys_are_scoped_to_their_brand(seeded):
    for brand, key in KEYS.items():
        headers = {"X-API-Key": key}
        assert seeded.get("/api/v1/client/visibility", headers=headers).json()["brandId"] == brand
        mine = seeded.get("/api/v1/client/incidents?limit=100", headers=headers).json()
        assert mine == get(seeded, "/api/v1/incidents", brand, limit=100)
        report = seeded.get("/api/v1/client/report", headers=headers).json()
        assert without_clock(report) == without_clock(get(seeded, "/api/v1/report", brand))
    assert seeded.get("/api/v1/client/incidents", headers={"X-API-Key": "fd_demo_viewer_2026"}).status_code == 403


# ---- Seed (section 7b additions) ---------------------------------------------------------------


def rows(folder: Path, name: str) -> list[dict]:
    return next(v for v in json.loads((folder / f"{name}.json").read_text(encoding="utf-8")).values())


@pytest.mark.parametrize("brand", ["brand_002", "brand_003"])
def test_seed_minimums_per_brand(brand):
    folder = DATA / "brands" / brand
    owners = rows(folder, "owners")
    assert sorted(o["role"] for o in owners) == ["Brand Data Owner", "CIRQO Trust and Safety Lead"]
    assert len(rows(folder, "answers")) >= 12 and len(rows(folder, "claims")) >= 30
    incidents = rows(folder, "incidents")
    assert len(incidents) >= 8
    assert {"auto_fixed", "pending_approval", "approved", "rejected"} <= {i["status"] for i in incidents}
    daily = rows(folder, "daily_metrics")
    assert [d["date"] for d in daily] == [d["date"] for d in rows(DATA, "daily_metrics")]
    assert daily[0]["accuracyRate"] != rows(DATA, "daily_metrics")[0]["accuracyRate"]


def test_brand_folders_are_deterministic_and_up_to_date(tmp_path):
    subprocess.run([sys.executable, str(BACKEND / "seed" / "generate.py"), "--out", str(tmp_path)],
                   check=True, capture_output=True)
    for brand in ("brand_002", "brand_003"):
        for f in (DATA / "brands" / brand).glob("*.json"):
            fresh = (tmp_path / "brands" / brand / f.name).read_bytes().replace(b"\r\n", b"\n")
            assert fresh == f.read_bytes().replace(b"\r\n", b"\n"), f"{brand}/{f.name} is stale: rerun generate.py"


def test_ids_are_unique_across_brands():
    folders = [DATA] + sorted((DATA / "brands").iterdir())
    for name, key in (("answers", "answerId"), ("claims", "claimId"), ("incidents", "incidentId"),
                      ("audit", "auditId"), ("owners", "ownerId")):
        ids = [r[key] for folder in folders for r in rows(folder, name)]
        assert len(ids) == len(set(ids)), name
