"""Dashboard numbers: visibility, sources, trust metrics and the report (BACKEND_CONTRACT.md section 7).

Every number is computed with plain code from the database, using the definitions in the contract,
for one brand (v1.3 section 7b; default brand_001, Kestrel, which is exactly the v1.2 behaviour).
"""

import statistics
from collections import defaultdict

from sqlalchemy import select

import constants as C
from db import Answer, Assistant, Brand, Claim, DailyMetric, Incident, Owner, Source
from services.checker import Catalog, brand_mentions
from services.scope import answer_visible_to
from timeutil import days_ago_iso, now_iso, parse_iso

OPEN_STATUSES = ("pending_approval", "escalated")


def answers_in_window(db, days: int, brand_id: str = C.DEFAULT_BRAND_ID) -> list[Answer]:
    """The brand's tracked answers plus brand-neutral ones, in the window."""
    return db.scalars(select(Answer).where(Answer.captured_at >= days_ago_iso(days),
                                           answer_visible_to(brand_id))).all()


def _visibility(answers: list[Answer], mentions: dict[str, list[str]], brand_id: str) -> dict:
    """visibilityRate, averageRank and mention count for one brand over a set of answers."""
    ranks = [mentions[a.answer_id].index(brand_id) + 1 for a in answers if brand_id in mentions[a.answer_id]]
    return {"visibilityRate": round(len(ranks) / len(answers), 2) if answers else 0.0,
            "averageRank": round(statistics.mean(ranks), 1) if ranks else 0.0,
            "mentions": len(ranks)}


def visibility_summary(db, days: int, brand_id: str = C.DEFAULT_BRAND_ID) -> dict:
    catalog = Catalog(db)
    client = db.get(Brand, brand_id)  # the brand being viewed
    answers = answers_in_window(db, days, brand_id)
    mentions = {a.answer_id: brand_mentions(a.answer_text, catalog) for a in answers}
    stats = {b.brand_id: _visibility(answers, mentions, b.brand_id) for b in catalog.brands.values()}
    total_mentions = sum(s["mentions"] for s in stats.values())

    def share(brand_id):
        return round(stats[brand_id]["mentions"] / total_mentions, 2) if total_mentions else 0.0

    assistants = db.scalars(select(Assistant).order_by(Assistant.assistant_id)).all()
    return {
        "brandId": client.brand_id, "brandName": client.name, "periodDays": days,
        "visibilityRate": stats[client.brand_id]["visibilityRate"],
        "averageRank": stats[client.brand_id]["averageRank"],
        "shareOfVoice": share(client.brand_id),
        "competitors": [
            {"brandName": b.name, "visibilityRate": stats[b.brand_id]["visibilityRate"],
             "averageRank": stats[b.brand_id]["averageRank"], "shareOfVoice": share(b.brand_id)}
            # Competitors = the other brands AI assistants mention in this brand's answers (with 153 brands in
            # the catalog, listing every one would drown the brands a shopper actually hears about).
            for b in sorted(catalog.brands.values(), key=lambda b: b.brand_id)
            if b.brand_id != client.brand_id and stats[b.brand_id]["mentions"] > 0],
        "byAssistant": [
            {"assistantId": a.assistant_id, "name": a.name,
             **{k: v for k, v in _visibility([x for x in answers if x.assistant_id == a.assistant_id], mentions,
                                             client.brand_id).items() if k != "mentions"}}
            for a in assistants],
    }


def sources_summary(db, days: int, brand_id: str = C.DEFAULT_BRAND_ID) -> list[dict]:
    answers = answers_in_window(db, days, brand_id)
    claims_by_answer = defaultdict(list)
    for c in db.scalars(select(Claim)).all():
        claims_by_answer[c.answer_id].append(c)
    count, correct, checked, last_seen = defaultdict(int), defaultdict(int), defaultdict(int), {}
    for a in answers:
        for sid in a.source_ids:
            count[sid] += 1
            last_seen[sid] = max(last_seen.get(sid, a.captured_at), a.captured_at)
            for c in claims_by_answer[a.answer_id]:
                checked[sid] += 1
                correct[sid] += c.status == "correct"
    total = sum(count.values())
    rows = []
    for s in db.scalars(select(Source)).all():
        rows.append({
            "sourceId": s.source_id, "name": s.name, "domain": s.domain, "type": s.type,
            "citationCount": count[s.source_id],
            "citationShare": round(count[s.source_id] / total, 2) if total else 0.0,
            # accuracyRate = share of correct claims in answers citing this source
            "accuracyRate": round(correct[s.source_id] / checked[s.source_id], 2) if checked[s.source_id] else 0.0,
            "lastSeenAt": last_seen.get(s.source_id),
        })
    rows.sort(key=lambda r: (-r["citationCount"], r["sourceId"]))
    return rows


def median_hours_to_resolve(incidents: list[Incident]) -> float:
    hours = [(parse_iso(i.resolved_at) - parse_iso(i.created_at)).total_seconds() / 3600
             for i in incidents if i.resolved_at]
    return round(statistics.median(hours), 1) if hours else 0.0


def false_alarm_rate(incidents: list[Incident]) -> float:
    """Incidents rejected as false alarms / incidents closed by a human."""
    human_closed = [i for i in incidents if i.resolved_at and i.resolved_by and i.resolved_by != "system"]
    if not human_closed:
        return 0.0
    return round(sum(1 for i in human_closed if i.status == "rejected" and i.false_alarm) / len(human_closed), 2)


def constraint_compliance_rate(db, days: int) -> float:
    """Plan 5.2 KPI: share of connector answers with stated hard constraints whose every shown product met them.
    Platform-wide (the connector serves all brands at once). 1.0 when no constrained answer was recorded yet."""
    rows = db.scalars(select(Answer).where(Answer.captured_at >= days_ago_iso(days),
                                           Answer.constraints_stated > 0)).all()
    if not rows:
        return 1.0
    return round(sum(1 for a in rows if a.constraints_met) / len(rows), 2)


def trust_metrics(db, days: int, brand_id: str = C.DEFAULT_BRAND_ID) -> dict:
    rows = db.scalars(select(DailyMetric).where(DailyMetric.brand_id == brand_id)
                      .order_by(DailyMetric.date)).all()[-days:]
    last7 = rows[-7:]
    # current = the last 7 days (contract section 7): the brand's incidents closed in that window.
    recently_closed = db.scalars(select(Incident).where(Incident.brand_id == brand_id,
                                                        Incident.resolved_at >= days_ago_iso(7))).all()

    def mean(key):
        return round(statistics.mean(getattr(r, key) for r in last7), 2) if last7 else 0.0

    return {
        "periodDays": days,
        "current": {
            "accuracyRate": mean("accuracy_rate"),
            "hallucinationRate": mean("hallucination_rate"),
            "medianTimeToResolveHours": median_hours_to_resolve(recently_closed),
            "falseAlarmRate": false_alarm_rate(recently_closed),
            "visibilityRate": mean("visibility_rate"),
            "constraintComplianceRate": constraint_compliance_rate(db, days),
        },
        "daily": [{"date": r.date, "accuracyRate": r.accuracy_rate, "hallucinationRate": r.hallucination_rate,
                   "claimsChecked": r.claims_checked, "incidentsOpened": r.incidents_opened,
                   "visibilityRate": r.visibility_rate} for r in rows],
    }


def report(db, days: int, brand_id: str = C.DEFAULT_BRAND_ID) -> dict:
    trust = trust_metrics(db, days, brand_id)
    first = trust["daily"][0] if trust["daily"] else {"accuracyRate": 0.0, "hallucinationRate": 0.0,
                                                      "visibilityRate": 0.0}
    since = days_ago_iso(days)
    incidents = db.scalars(select(Incident).where(Incident.brand_id == brand_id, Incident.created_at >= since)).all()
    top = sources_summary(db, days, brand_id)[:3]
    owners = db.scalars(select(Owner).where(Owner.brand_id == brand_id).order_by(Owner.owner_id)).all()
    open_high = sorted(i.incident_id for i in incidents
                       if i.status in OPEN_STATUSES and i.severity in ("high", "critical"))
    return {
        "generatedAt": now_iso(), "periodDays": days, "brandName": db.get(Brand, brand_id).name,
        "impact": {
            "accuracyStart": first["accuracyRate"], "accuracyEnd": trust["current"]["accuracyRate"],
            "hallucinationStart": first["hallucinationRate"], "hallucinationEnd": trust["current"]["hallucinationRate"],
            "visibilityStart": first["visibilityRate"], "visibilityEnd": trust["current"]["visibilityRate"],
        },
        "incidents": {
            "total": len(incidents),
            "autoFixed": sum(i.status == "auto_fixed" for i in incidents),
            "humanApproved": sum(i.status == "approved" for i in incidents),
            "rejected": sum(i.status == "rejected" for i in incidents),
            "escalated": sum(i.handling == "escalate" for i in incidents),
            "open": sum(i.status in OPEN_STATUSES for i in incidents),
            "medianTimeToResolveHours": median_hours_to_resolve(incidents),
        },
        "topSources": [{"sourceId": s["sourceId"], "name": s["name"], "citationShare": s["citationShare"],
                        "accuracyRate": s["accuracyRate"]} for s in top],
        "openHighRisk": open_high,
        "governance": {
            "automated": ["low and medium price, spec, and availability fixes"],
            "humanReviewed": ["large price errors", "invented features", "policy misstatements",
                              "unfair comparisons"],
            "escalateOnly": ["safety and legal claims"],
            "owners": [{"name": o.name, "role": o.role} for o in owners],
        },
    }
