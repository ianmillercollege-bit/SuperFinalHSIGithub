"""Rebuild the database from seed JSON on every startup (BACKEND_CONTRACT.md section 3).

backend/seed/generate.py writes the JSON files to backend/seed/data/ (DECISIONS.md #17).
Tests point SEED_DIR at backend/tests/fixtures/, a small set in the same shapes.

The main files hold the catalog and the default brand's account (Kestrel, brand_001). Each extra
brand account (contract v1.3 section 7b) has a subfolder brands/<brandId>/ with its own owners,
answers, claims, incidents, audit and daily_metrics, in the same shapes.

Dates are moved to the present on load: daily metric dates by whole days, so the 30-day trend ends
today (UTC); event timestamps by an exact offset, so the newest seeded event lands one minute before
now. (Whole days alone put seed events up to a day in the future right after midnight UTC, which made
a fresh approval look older than the incident it closed.)
"""

import json
import os
from datetime import date
from pathlib import Path

import constants as C
from sqlalchemy import insert

from db import (Answer, ApiKey, Assistant, AuditEntry, Base, Brand, Claim, CommunityOrg, CommunityRequest,
                ComparisonFact, DailyMetric, Incident, LoginAlias, Owner, Product, SessionLocal, Source, User,
                engine)
from services.community import load_community
from services.passwords import hash_password
from timeutil import now, parse_iso, shift_date, shift_iso_seconds, today

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


EVENT_FIELDS = {"products": ("updatedAt", "verifiedAt"), "answers": ("capturedAt",), "claims": ("checkedAt",),
                "incidents": ("createdAt", "resolvedAt"), "audit": ("timestamp",)}
LIST_KEYS = {"products": "products", "answers": "answers", "claims": "claims", "incidents": "incidents",
             "audit": "entries"}


def brand_folders(folder: Path) -> list[tuple[str, Path]]:
    """Extra brand accounts: (brandId, folder) for each brands/<brandId>/ subfolder."""
    root = folder / "brands"
    return sorted((d.name, d) for d in root.iterdir() if d.is_dir()) if root.is_dir() else []


def event_offset(folders: list[Path]) -> float:
    """Seconds to add to every seeded timestamp so the newest one is one minute before now."""
    stamps = [parse_iso(r[f]) for folder in folders for name, fields in EVENT_FIELDS.items()
              for r in read_list(folder, name, LIST_KEYS[name]) for f in fields if r.get(f)]
    if not stamps:
        return 0.0
    return (now() - max(stamps)).total_seconds() - 60


def catalog_folder(folder: Path) -> Path | None:
    """The catalog at scale (contract v1.4.1): brands, profiles, products, comparisons, users and dashboard
    data for the spreadsheet's companies. Every dashboard row carries its brandId."""
    path = folder / "catalog"
    return path if (path / "brands.json").exists() else None


def load(db, folder: Path) -> dict:
    daily_rows = read_list(folder, "daily_metrics", "daily")
    shift = 0
    if daily_rows:
        last = max(date.fromisoformat(r["date"]) for r in daily_rows)
        shift = (today() - last).days

    catalog = catalog_folder(folder)
    accounts = [(C.DEFAULT_BRAND_ID, folder)] + brand_folders(folder) + ([(C.DEFAULT_BRAND_ID, catalog)] if catalog else [])
    offset = event_offset([path for _, path in accounts])

    def moved(value):
        return shift_iso_seconds(value, offset)

    rows = {table: [] for table in (Brand, Product, Assistant, Source, ComparisonFact, User, Owner, Answer, Claim,
                                    Incident, AuditEntry, DailyMetric, ApiKey, CommunityOrg, CommunityRequest,
                                    LoginAlias)}
    profiles = {r["brandId"]: {k: v for k, v in r.items() if k != "brandId"}
                for r in (read_list(catalog, "profiles", "profiles") if catalog else [])}
    brands = read_list(folder, "brands", "brands") + (read_list(catalog, "brands", "brands") if catalog else [])
    for r in brands:
        rows[Brand].append(dict(brand_id=r["brandId"], name=pick(r, "name", "brandName"),
                                is_client=bool(pick(r, "isClient", default=False)), billing_tier=pick(r, "billingTier"),
                                profile=profiles.get(r["brandId"], {})))
    brand_ids = {r["brandId"] for r in brands}

    product_brand = {}
    products = read_list(folder, "products", "products") + (read_list(catalog, "products", "products") if catalog else [])
    for r in products:
        product_brand[r["productId"]] = r["brandId"]
        rows[Product].append(dict(
            product_id=r["productId"], brand_id=r["brandId"], name=r["name"], price=float(r["price"]),
            currency=pick(r, "currency", default="USD"), availability=r["availability"], specs=r["specs"],
            return_policy_days=int(r["returnPolicyDays"]), updated_at=moved(r["updatedAt"]),
            fact_source=r["factSource"], fact_source_url=r["factSourceUrl"], verified_at=moved(r["verifiedAt"]),
            price_history=previous_prices(r), features=[f.lower() for f in pick(r, "features", default=[])],
            category=pick(r, "category", default="laptops"), subcategory=pick(r, "subcategory", default="Laptop")))

    for r in read_list(folder, "assistants", "assistants"):
        rows[Assistant].append(dict(assistant_id=r["assistantId"], name=r["name"]))
    for r in read_list(folder, "sources", "sources"):
        rows[Source].append(dict(source_id=r["sourceId"], name=r["name"], domain=r["domain"], type=r["type"]))

    if catalog:
        for r in read_list(catalog, "comparisons", "comparisons"):
            rows[ComparisonFact].append(dict(fact_id=r["factId"], product_id=r["productId"],
                                             other_product_id=r["otherProductId"], attribute=r["attribute"],
                                             text=r["text"]))
        # Every demo password is cirqo-demo (DECISIONS.md #34): hashed once per rebuild, never stored in plain text.
        demo_hash = hash_password(C.DEMO_PASSWORD)
        for r in read_list(catalog, "users", "users"):
            rows[User].append(dict(user_id=r["userId"], username=r["username"].lower(), name=r["name"],
                                   role=r["role"], title=pick(r, "title"), brand_id=pick(r, "brandId"),
                                   password_hash=demo_hash, sheet_password_hash=pick(r, "sheetPasswordHash")))
            # v1.7: the 9 renamed companies also sign in with their original sheet email.
            for alias in r.get("aliases", []):
                rows[LoginAlias].append(dict(alias=alias.lower(), user_id=r["userId"]))

    answer_brand, incident_brand, claim_answer = {}, {}, {}
    for brand_id, path in accounts:
        load_account(rows, path, brand_id, moved, product_brand, answer_brand, incident_brand, claim_answer)

    def audit_brand(target_id: str, fallback: str) -> str | None:
        """An audit entry belongs to the brand of what it is about."""
        if target_id in incident_brand:
            return incident_brand[target_id]
        if target_id in claim_answer:
            return answer_brand.get(claim_answer[target_id], fallback)
        if target_id in answer_brand:
            return answer_brand[target_id]
        return target_id if target_id in brand_ids else fallback

    for brand_id, path in accounts:
        for r in read_list(path, "audit", "entries"):
            rows[AuditEntry].append(dict(audit_id=r["auditId"], timestamp=moved(r["timestamp"]), actor=r["actor"],
                                         actor_type=r["actorType"], action=r["action"], target_id=r["targetId"],
                                         details=pick(r, "details", default=""),
                                         brand_id=pick(r, "brandId", default=audit_brand(r["targetId"], brand_id))))
        for r in (daily_rows if path == folder else read_list(path, "daily_metrics", "daily")):
            rows[DailyMetric].append(dict(brand_id=pick(r, "brandId", default=brand_id),
                                          date=shift_date(r["date"], shift), accuracy_rate=r["accuracyRate"],
                                          hallucination_rate=r["hallucinationRate"], claims_checked=r["claimsChecked"],
                                          incidents_opened=r["incidentsOpened"], visibility_rate=r["visibilityRate"]))

    # Community program (contract v1.6 section 7e): condition, pledges, partner logins and requests.
    load_community(rows, folder, moved)

    # Client API keys (CLIENT_API_CONTRACT.md v1.1): the demo keys of the brands that exist, plus one owner
    # key for each of the first spreadsheet companies (v1.4 demo accounts).
    for account in demo_accounts(brands, rows[User]):
        rows[ApiKey].append(dict(api_key=account["apiKey"], brand_id=account["brandId"], role=account["role"]))

    # Bulk inserts: about 25,000 rows at catalog scale, well inside the 10-second rebuild (contract v1.4.1).
    for table, table_rows in rows.items():
        if table_rows:
            db.execute(insert(table), table_rows)
    db.commit()
    return {"folder": str(folder), "shiftDays": shift, "shiftSeconds": offset,
            "brandAccounts": [brand_id for brand_id, _ in accounts], "catalog": bool(catalog)}


def demo_accounts(brands: list[dict], users: list[dict]) -> list[dict]:
    """The demo logins: the original brands' accounts, then the first spreadsheet companies' admins."""
    known = {b["brandId"]: b for b in brands}
    accounts = [dict(a) for a in C.DEMO_ACCOUNTS if a["brandId"] in known]
    originals = {a["brandId"] for a in C.DEMO_ACCOUNTS}
    sheet = [b for b in brands if b["brandId"] not in originals and b.get("isClient") is False][:C.SHEET_DEMO_COMPANIES]
    for b in sheet:
        admin = next((u for u in users if u["brand_id"] == b["brandId"]), None)
        if admin:
            slug = "".join(ch if ch.isalnum() else "-" for ch in b["name"].lower()).strip("-")
            accounts.append({"brandId": b["brandId"], "role": "owner", "apiKey": f"fd_demo_{slug}_2026",
                             "username": admin["username"]})
    return accounts


def load_account(rows: dict, path: Path, brand_id: str, moved, product_brand: dict, answer_brand: dict,
                 incident_brand: dict, claim_answer: dict) -> None:
    """Owners, answers, claims and incidents of one brand account (or of many, when rows carry brandId)."""
    for r in read_list(path, "owners", "owners"):
        rows[Owner].append(dict(owner_id=r["ownerId"], name=r["name"], role=r["role"],
                                incident_types=r["incidentTypes"], brand_id=pick(r, "brandId", default=brand_id)))

    for r in read_list(path, "answers", "answers"):
        answer_brand[r["answerId"]] = pick(r, "brandId", default=brand_id)
        rows[Answer].append(dict(answer_id=r["answerId"], query_text=r["queryText"], assistant_id=r["assistantId"],
                                 answer_text=r["answerText"],
                                 brand_mentioned=bool(pick(r, "brandMentioned", default=False)),
                                 rank=pick(r, "rank"), source_ids=pick(r, "sourceIds", default=[]),
                                 captured_at=moved(r["capturedAt"]), source=pick(r, "source", default="mock"),
                                 brand_id=answer_brand[r["answerId"]]))

    for r in read_list(path, "claims", "claims"):
        claim_answer[r["claimId"]] = r["answerId"]
        rows[Claim].append(dict(claim_id=r["claimId"], answer_id=r["answerId"], product_id=pick(r, "productId"),
                                text=r["text"], claim_type=r["claimType"], extracted_value=pick(r, "extractedValue"),
                                verified_value=pick(r, "verifiedValue"), status=r["status"],
                                rule_id=pick(r, "ruleId"), fact_id=pick(r, "factId"),
                                reason=pick(r, "reason", default=""), checked_at=moved(r["checkedAt"])))

    for r in read_list(path, "incidents", "incidents"):
        # An incident belongs to the brand that owns the product (v1.3 section 7b).
        owner_brand = pick(r, "brandId", default=product_brand.get(pick(r, "productId"), brand_id))
        incident_brand[r["incidentId"]] = owner_brand
        rows[Incident].append(dict(
            incident_id=r["incidentId"], claim_id=r["claimId"], answer_id=r["answerId"],
            product_id=pick(r, "productId"), rule_id=r["ruleId"], severity=r["severity"], handling=r["handling"],
            status=r["status"], summary=r["summary"], ai_said=pick(r, "aiSaid"), verified_fact=pick(r, "verifiedFact"),
            proposed_fix=pick(r, "proposedFix"), owner_id=r["ownerId"], owner_name=r["ownerName"],
            false_alarm=bool(pick(r, "falseAlarm", default=False)), created_at=moved(r["createdAt"]),
            resolved_at=moved(pick(r, "resolvedAt")), resolved_by=pick(r, "resolvedBy"), brand_id=owner_brand))


def rebuild_database() -> dict:
    """Drop everything and reload from seed. Called on startup and by tests."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        return load(db, seed_dir())
