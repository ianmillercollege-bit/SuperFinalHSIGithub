"""Seed timestamps are moved to the present on load, at any time of day (seed_loader.event_offset).

Regression: moving by whole days alone put seeded events up to ~17 hours in the future right after
midnight UTC, so a fresh approval looked older than the incident it closed.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

import seed_loader
from db import Answer, AuditEntry, Claim, DailyMetric, Incident, Product, SessionLocal


@pytest.mark.parametrize("clock", ["2026-10-01T00:05:00", "2026-10-01T12:00:00", "2026-10-01T23:55:00",
                                   "2026-09-29T10:00:00"])
def test_no_seeded_event_is_in_the_future(monkeypatch, clock):
    fake_now = datetime.fromisoformat(clock).replace(tzinfo=timezone.utc)
    monkeypatch.setattr(seed_loader, "now", lambda: fake_now)
    monkeypatch.setattr(seed_loader, "today", lambda: fake_now.date())
    seed_loader.rebuild_database()
    now_text = fake_now.strftime("%Y-%m-%dT%H:%M:%SZ")
    with SessionLocal() as db:
        newest = max(filter(None, [
            db.scalar(select(func.max(Answer.captured_at))), db.scalar(select(func.max(Claim.checked_at))),
            db.scalar(select(func.max(Incident.created_at))), db.scalar(select(func.max(Incident.resolved_at))),
            db.scalar(select(func.max(AuditEntry.timestamp))), db.scalar(select(func.max(Product.verified_at)))]))
        assert newest < now_text  # nothing in the future
        assert newest >= fake_now.replace(hour=0, minute=0).strftime("%Y-%m-%dT%H:%M:%SZ") or \
            fake_now.hour == 0  # and it is recent
        # The 30-day trend still ends today.
        assert db.scalar(select(func.max(DailyMetric.date))) == fake_now.date().isoformat()


def test_approval_made_now_is_newest_in_the_audit_log(client):
    res = client.post("/api/v1/incidents/inc_44/approve", json={"approverName": "Grace Kim"})
    body = res.json()
    assert body["resolvedAt"] >= body["createdAt"]
    newest = client.get("/api/v1/audit?targetId=inc_44").json()["entries"][0]
    assert newest["action"] == "approved"
