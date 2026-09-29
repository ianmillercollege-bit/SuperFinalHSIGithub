"""Rebuild the database from seed JSON on every startup (BACKEND_CONTRACT.md section 3).

backend/seed/generate.py writes the JSON files to backend/seed/data/ (DECISIONS.md #17).
Tests point SEED_DIR at backend/tests/fixtures/, a small set in the same shapes.

All seed dates are shifted by whole days so the 30-day trend always ends today (UTC).
"""

import json
import os
from datetime import date
from pathlib import Path

from db import (Answer, Assistant, AuditEntry, Base, Brand, Claim, DailyMetric, Incident, Owner, Product,
                SessionLocal, Source, engine)
from timeutil import shift_date, shift_iso, today

BACKEND_DIR = Path(__file__).resolve().parent
DEFAULT_SEED_DIR = BACKEND_DIR / "seed" / "data"


def seed_dir() -> Path:
    """backend/seed/data/, or the folder in SEED_DIR. No silent fallback to test data."""
    folder = Path(os.environ.get("SEED_DIR") or DEFAULT_SEED_DIR)
    if not (folder / "products.json").exists():
        raise FileNotFoundError(
            f"No seed data in {folder}. Run backend/seed/generate.py to create backend/seed/data/, "
            "or set SEED_DIR to a folder with the DECISIONS.md #17 JSON files.")
    return folder


def read_list(folder: Path, name: str, key: str) -> list[dict]:
    """Accept either a bare list or a list wrapped in an object like {"products": [...]}."""
    path = folder / f"{name}.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if key in data:
        return data[key]
    lists = [v for v in data.values() if isinstance(v, list)]
    return lists[0] if len(lists) == 1 else []


def pick(row: dict, *names, default=None):
    for n in names:
        if n in row and row[n] is not None:
            return row[n]
    return default


def previous_prices(row: dict) -> list[float]:
    history = pick(row, "priceHistory", "previousPrices", default=[])
    prices = []
    for h in history:
        value = h if isinstance(h, (int, float)) else pick(h, "price", "amount")
        if value is not None:
            prices.append(float(value))
    current = float(row["price"])
    # The current price is not a "previous" price.
    return [p for p in prices if abs(p - current) > 0.005]


def load(db, folder: Path) -> dict:
    daily_rows = read_list(folder, "daily_metrics", "daily")
    shift = 0
    if daily_rows:
        last = max(date.fromisoformat(r["date"]) for r in daily_rows)
        shift = (today() - last).days

    brands = read_list(folder, "brands", "brands")
    for r in brands:
        db.add(Brand(brand_id=r["brandId"], name=pick(r, "name", "brandName"),
                     is_client=bool(pick(r, "isClient", default=False)), billing_tier=pick(r, "billingTier")))

    for r in read_list(folder, "products", "products"):
        db.add(Product(product_id=r["productId"], brand_id=r["brandId"], name=r["name"], price=float(r["price"]),
                       currency=pick(r, "currency", default="USD"), availability=r["availability"],
                       specs=r["specs"], return_policy_days=int(r["returnPolicyDays"]),
                       updated_at=shift_iso(r["updatedAt"], shift), price_history=previous_prices(r),
                       features=[f.lower() for f in pick(r, "features", default=[])]))

    for r in read_list(folder, "assistants", "assistants"):
        db.add(Assistant(assistant_id=r["assistantId"], name=r["name"]))

    for r in read_list(folder, "sources", "sources"):
        db.add(Source(source_id=r["sourceId"], name=r["name"], domain=r["domain"], type=r["type"]))

    for r in read_list(folder, "owners", "owners"):
        db.add(Owner(owner_id=r["ownerId"], name=r["name"], role=r["role"], incident_types=r["incidentTypes"]))

    for r in read_list(folder, "answers", "answers"):
        db.add(Answer(answer_id=r["answerId"], query_text=r["queryText"], assistant_id=r["assistantId"],
                      answer_text=r["answerText"], brand_mentioned=bool(pick(r, "brandMentioned", default=False)),
                      rank=pick(r, "rank"), source_ids=pick(r, "sourceIds", default=[]),
                      captured_at=shift_iso(r["capturedAt"], shift), source=pick(r, "source", default="mock")))

    for r in read_list(folder, "claims", "claims"):
        db.add(Claim(claim_id=r["claimId"], answer_id=r["answerId"], product_id=pick(r, "productId"), text=r["text"],
                     claim_type=r["claimType"], extracted_value=pick(r, "extractedValue"),
                     verified_value=pick(r, "verifiedValue"), status=r["status"], rule_id=pick(r, "ruleId"),
                     fact_id=pick(r, "factId"), reason=pick(r, "reason", default=""),
                     checked_at=shift_iso(r["checkedAt"], shift)))

    for r in read_list(folder, "incidents", "incidents"):
        db.add(Incident(incident_id=r["incidentId"], claim_id=r["claimId"], answer_id=r["answerId"],
                        product_id=pick(r, "productId"), rule_id=r["ruleId"], severity=r["severity"],
                        handling=r["handling"], status=r["status"], summary=r["summary"], ai_said=pick(r, "aiSaid"),
                        verified_fact=pick(r, "verifiedFact"), proposed_fix=pick(r, "proposedFix"),
                        owner_id=r["ownerId"], owner_name=r["ownerName"],
                        false_alarm=bool(pick(r, "falseAlarm", default=False)),
                        created_at=shift_iso(r["createdAt"], shift),
                        resolved_at=shift_iso(pick(r, "resolvedAt"), shift), resolved_by=pick(r, "resolvedBy")))

    for r in read_list(folder, "audit", "entries"):
        db.add(AuditEntry(audit_id=r["auditId"], timestamp=shift_iso(r["timestamp"], shift), actor=r["actor"],
                          actor_type=r["actorType"], action=r["action"], target_id=r["targetId"],
                          details=pick(r, "details", default="")))

    for r in daily_rows:
        db.add(DailyMetric(date=shift_date(r["date"], shift), accuracy_rate=r["accuracyRate"],
                           hallucination_rate=r["hallucinationRate"], claims_checked=r["claimsChecked"],
                           incidents_opened=r["incidentsOpened"], visibility_rate=r["visibilityRate"]))

    db.commit()
    return {"folder": str(folder), "shiftDays": shift}


def rebuild_database() -> dict:
    """Drop everything and reload from seed. Called on startup and by tests."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        return load(db, seed_dir())
