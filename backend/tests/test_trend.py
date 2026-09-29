"""BACKEND_CONTRACT.md section 9: the 30-day trend is the proof of impact."""

import statistics

from timeutil import today


def test_trend_improves(client):
    body = client.get("/api/v1/metrics/trust?days=30").json()
    daily = body["daily"]
    assert len(daily) == 30
    dates = [d["date"] for d in daily]
    assert dates == sorted(dates) and dates[-1] == today().isoformat()  # oldest first, ending today

    # 7-day averages must improve every week (weeks ending today, 7 days, 14 days and 21 days ago).
    for key, better in (("accuracyRate", 1), ("hallucinationRate", -1), ("visibilityRate", 1)):
        weeks = [statistics.mean(d[key] for d in daily[end - 7:end]) for end in (9, 16, 23, 30)]
        assert all((b - a) * better > 0 for a, b in zip(weeks, weeks[1:])), (key, weeks)

    # current = the last 7 days.
    last7 = daily[-7:]
    assert body["current"]["accuracyRate"] == round(statistics.mean(d["accuracyRate"] for d in last7), 2)
    assert body["current"]["accuracyRate"] > daily[0]["accuracyRate"]
    assert body["current"]["hallucinationRate"] < daily[0]["hallucinationRate"]


def test_days_parameter(client):
    assert len(client.get("/api/v1/metrics/trust?days=7").json()["daily"]) == 7
    for bad in (0, 31):
        assert client.get(f"/api/v1/metrics/trust?days={bad}").status_code == 422


def test_report_matches_trust_metrics(client):
    trust = client.get("/api/v1/metrics/trust?days=30").json()
    report = client.get("/api/v1/report?days=30").json()
    assert report["impact"]["accuracyStart"] == trust["daily"][0]["accuracyRate"]
    assert report["impact"]["accuracyEnd"] == trust["current"]["accuracyRate"]
    assert report["brandName"] == "Kestrel"
    for iid in report["openHighRisk"]:
        i = client.get(f"/api/v1/incidents/{iid}").json()
        assert i["status"] in ("pending_approval", "escalated") and i["severity"] in ("high", "critical")
