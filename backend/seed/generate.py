"""Generate the CIRQO seed set: backend/seed/data/*.json (DECISIONS.md #17).

Meets every requirement in BACKEND_CONTRACT.md section 9 and stays consistent with shared/mock/:
the catalog, owners, sources, the example answers, claims, incidents, audit entries and the
30-day trend are taken from shared/mock/ unchanged, then older history is added around them.

Extra answers are built from sentence templates. Their claims come from running the real
plain-code checker (services/checker.py), so the seed agrees with what the server would find.

Deterministic: a fixed random seed and a fixed reference date. Running it twice gives identical files.
The backend shifts all dates on load so the trend always ends on the current day.

Usage (from the repo root or backend/):  python backend/seed/generate.py [--out DIR]
"""

import argparse
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent
BACKEND = SEED_DIR.parent
MOCK = BACKEND.parent / "shared" / "mock"
sys.path.insert(0, str(BACKEND))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from db import Base, Brand, Product  # noqa: E402
from services.checker import (Catalog, check, describe, extract_claims,  # noqa: E402
                              severity_and_handling)

RANDOM_SEED = 20260929
REFERENCE = datetime(2026, 9, 29, 18, 0, 0, tzinfo=timezone.utc)  # last day of the mock trend
GENERATED_ANSWERS = 40
# After the scheduled answers, this share of answers mentions Kestrel; the rest only mention
# competitors. Keeps Kestrel's visibility realistic (about half, like shared/mock).
KESTREL_ANSWER_SHARE = 0.3

# ---- Catalog additions that shared/mock does not carry ---------------------------------------

BRANDS = [  # isClient / billingTier are seed-only: never returned, never read by ranking.
    {"brandId": "brand_001", "name": "Kestrel", "isClient": True, "billingTier": "pro"},
    {"brandId": "brand_002", "name": "Arcton", "isClient": False, "billingTier": None},
    {"brandId": "brand_003", "name": "Novex", "isClient": False, "billingTier": None},
]
# Contract v1.1 section 7: connector answers cite the brand's own verified feed.
BRAND_FEED_SOURCE = {"sourceId": "src_brand", "name": "Kestrel Verified Feed (CIRQO Verified Data Layer)",
                     "domain": "feed.cirqo.example", "type": "brand_site"}
ASSISTANTS = [
    {"assistantId": "ast_01", "name": "Assistant A", "simulated": True},
    {"assistantId": "ast_02", "name": "Assistant B", "simulated": True},
    {"assistantId": "ast_03", "name": "Assistant C", "simulated": True},
]
# One previous price per product (section 9). prod_002's $339 matches mock claim clm_308.
PREVIOUS_PRICE = {"prod_001": 479.99, "prod_002": 339.00, "prod_003": 499.99, "prod_004": 649.99,
                  "prod_005": 579.00, "prod_006": 399.00, "prod_007": 499.00, "prod_008": 369.00,
                  "prod_009": 549.00, "prod_010": 489.00, "prod_011": 529.00, "prod_012": 749.00}
PRICE_CHANGED_ON = "2026-09-15"

QUERIES = ["best laptops under $500", "lightweight laptop for college", "best laptop for students",
           "laptop with the longest battery life", "best budget laptop", "touchscreen laptop under $500",
           "best 15 inch laptop for work", "laptop for streaming and media", "most reliable laptop brand",
           "best laptop for travel", "cheapest decent laptop", "laptop with the best return policy"]
UNKNOWN_MODELS = ["Zephyr Book 13", "Orion Slim 14", "Lumen Pro 15"]

# The first nine generated answers each carry one of these, so every ruleId is covered.
RULE_SCHEDULE = ["PRICE_MISMATCH", "PRICE_OUTDATED", "SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH",
                 "POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL", "NO_FACT"]
# Closed human-reviewed incidents (older than 7 days) cycle through these outcomes.
HUMAN_OUTCOMES = ["approved", "rejected_false_alarm", "approved", "rejected", "approved"]

# Human reviews closed in the last 7 days: (days ago, rule, outcome, minutes to resolve). With the
# shared/mock incidents in the same window (3 human-closed, 1 of them a false alarm, plus 4 instant
# auto-fixes), this gives a current falseAlarmRate near 0.08 and a median time to resolve near
# 2.2 hours, in line with the contract's report example (0.06 and 2.5 hours).
RECENT_REVIEWS = [
    (6, "INVENTED_FEATURE", "approved", 60),
    (6, "POLICY_MISMATCH", "approved", 150),
    (5, "UNFAIR_COMPARISON", "rejected", 240),
    (5, "SAFETY_LEGAL", "resolved", 300),
    (5, "INVENTED_FEATURE", "approved", 90),
    (4, "POLICY_MISMATCH", "approved", 165),
    (4, "UNFAIR_COMPARISON", "approved", 180),
    (3, "SAFETY_LEGAL", "resolved", 210),
    (3, "INVENTED_FEATURE", "approved", 120),
    (2, "POLICY_MISMATCH", "approved", 135),
]


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mock(name: str, key: str) -> list[dict]:
    return json.loads((MOCK / name).read_text(encoding="utf-8"))[key]


def money(value: float) -> str:
    return f"${value:.2f}"


def num(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def free_ids(prefix: str, used: set[str], width: int, start: int = 1):
    n = start
    while True:
        candidate = f"{prefix}_{n:0{width}d}"
        if candidate not in used:
            yield candidate
        n += 1


# ---- Sentence templates ----------------------------------------------------------------------


def correct_sentence(rng: random.Random, p: dict, brand: str) -> str:
    s = p["specs"]
    options = [
        f"The {p['name']} costs {money(p['price'])}.",
        f"The {p['name']} is rated for {num(s['batteryHours'])} hours of battery life.",
        f"The {p['name']} weighs {num(s['weightLb'])} lb.",
        f"The {p['name']} has {num(s['ramGb'])} GB of RAM.",
        f"The {p['name']} comes with {num(s['storageGb'])} GB of storage.",
        f"The {p['name']} has a {num(s['screenInches'])}-inch display.",
        f"{brand} offers a {p['returnPolicyDays']}-day return policy on the {p['name']}.",
        {"in_stock": f"The {p['name']} is in stock.", "low_stock": f"The {p['name']} has limited stock.",
         "out_of_stock": f"The {p['name']} is out of stock."}[p["availability"]],
    ]
    return rng.choice(options)


def wrong_sentence(rng: random.Random, rule: str, p: dict, brand: str, products: list[dict]) -> str:
    s, name = p["specs"], p["name"]
    if rule == "PRICE_MISMATCH":
        for factor in rng.sample([0.97, 0.92, 0.82, 1.08, 0.88], 5):
            stated = float(round(p["price"] * factor))
            if abs(stated - p["price"]) / p["price"] > 0.012 and \
                    abs(stated - PREVIOUS_PRICE[p["productId"]]) / PREVIOUS_PRICE[p["productId"]] > 0.012:
                return f"The {name} costs ${num(stated)}."
        return f"The {name} costs ${num(round(p['price'] * 0.8))}."
    if rule == "PRICE_OUTDATED":
        return f"The {name} costs {money(PREVIOUS_PRICE[p['productId']])}."
    if rule == "SPEC_MISMATCH":
        return rng.choice([
            f"The {name} has {num(s['ramGb'] * 2)} GB of RAM.",
            f"The {name} is rated for {num(s['batteryHours'] + 3)} hours of battery life.",
            f"The {name} weighs {num(round(s['weightLb'] + 0.8, 1))} lb.",
            f"The {name} comes with {num(s['storageGb'] * 2)} GB of storage.",
        ])
    if rule == "INVENTED_FEATURE":
        options = [f"The {name} includes a fingerprint reader.", f"The {name} includes a backlit keyboard.",
                   f"The {name} includes stylus support.", f"The {name} includes 5G connectivity."]
        if not s["touchscreen"]:
            options.append(f"The {name} has a touchscreen.")
        return rng.choice(options)
    if rule == "AVAILABILITY_MISMATCH":
        wrong = {"in_stock": "is out of stock", "low_stock": "is out of stock", "out_of_stock": "is in stock"}
        return f"The {name} {wrong[p['availability']]}."
    if rule == "POLICY_MISMATCH":
        days = rng.choice([d for d in (45, 60, 90) if d != p["returnPolicyDays"]])
        return f"{brand} offers a {days}-day return policy on the {name}."
    if rule == "UNFAIR_COMPARISON":
        rival = rng.choice([x for x in products if x["brandId"] != "brand_001"])["name"]
        return rng.choice([f"The {rival} is more reliable than the {name}.",
                           f"Unlike the {name}, the {rival} never overheats.",
                           f"The {rival} outperforms the {name} for everyday use."])
    if rule == "SAFETY_LEGAL":
        return rng.choice([f"The {name} is certified child-safe.", f"The {name} comes with a lifetime guarantee.",
                           f"The {name} is safe for toddlers to use unsupervised.",
                           f"The {name} was part of a recall last year."])
    if rule == "NO_FACT":
        return f"The {rng.choice(UNKNOWN_MODELS)} is great for students."
    raise ValueError(rule)


# ---- Build -----------------------------------------------------------------------------------


def build() -> dict[str, list[dict]]:
    rng = random.Random(RANDOM_SEED)

    # Catalog from shared/mock, plus the seed-only fields.
    products = []
    for p in mock("products.json", "products"):
        p = {k: v for k, v in p.items() if k != "brandName"}
        p["priceHistory"] = [
            {"price": PREVIOUS_PRICE[p["productId"]], "effectiveFrom": "2026-08-01", "effectiveTo": PRICE_CHANGED_ON},
            {"price": p["price"], "effectiveFrom": PRICE_CHANGED_ON, "effectiveTo": None}]
        products.append(p)
    by_id = {p["productId"]: p for p in products}
    brand_name = {b["brandId"]: b["name"] for b in BRANDS}
    owners = mock("owners.json", "owners")
    owner_for = {rule: o for o in owners for rule in o["incidentTypes"]}
    sources = [{k: s[k] for k in ("sourceId", "name", "domain", "type")} for s in mock("sources.json", "sources")]
    cited_by_assistants = [s["sourceId"] for s in sources]  # third-party answers never cite the brand feed
    if not any(s["sourceId"] == BRAND_FEED_SOURCE["sourceId"] for s in sources):
        sources.append(BRAND_FEED_SOURCE)
    assistant_name = {a["assistantId"]: a["name"] for a in ASSISTANTS}

    # Mock history, unchanged.
    answers = [{k: v for k, v in a.items() if k != "assistantName"} for a in mock("answers.json", "answers")]
    claims = list(mock("claims.json", "claims"))
    incidents = list(mock("incidents.json", "incidents"))
    audit = list(mock("audit.json", "entries"))
    daily = mock("metrics_trust.json", "daily")

    # The two older answers that mock incidents inc_20 and inc_28 point to.
    answers += [
        {"answerId": "ans_081", "queryText": "best laptop for work", "assistantId": "ast_01",
         "answerText": "The Kestrel Studio 15 is UL listed, and its 15.6-inch screen suits office work.",
         "brandMentioned": True, "rank": 1, "sourceIds": ["src_05"], "capturedAt": "2026-09-25T09:30:00Z",
         "source": "mock"},
        {"answerId": "ans_098", "queryText": "laptop with the longest battery life", "assistantId": "ast_02",
         "answerText": "The Kestrel Aero 14 Plus outlasts the Arcton Swift 14 on battery. Both are solid picks.",
         "brandMentioned": True, "rank": 1, "sourceIds": ["src_01"], "capturedAt": "2026-09-27T12:30:00Z",
         "source": "mock"},
    ]
    claims += [
        {"claimId": "clm_231", "answerId": "ans_081", "productId": "prod_004",
         "text": "The Kestrel Studio 15 is UL listed, and its 15.6-inch screen suits office work.",
         "claimType": "safety_legal", "extractedValue": "UL listed", "verifiedValue": None, "status": "unverifiable",
         "ruleId": "SAFETY_LEGAL", "factId": None,
         "reason": "Contains safety/legal keyword(s): UL listed. Escalated for human review.",
         "checkedAt": "2026-09-25T10:00:00Z"},
        {"claimId": "clm_262", "answerId": "ans_098", "productId": "prod_005",
         "text": "The Kestrel Aero 14 Plus outlasts the Arcton Swift 14 on battery.", "claimType": "comparison",
         "extractedValue": "The Kestrel Aero 14 Plus outlasts the Arcton Swift 14 on battery.",
         "verifiedValue": None, "status": "incorrect", "ruleId": "UNFAIR_COMPARISON", "factId": None,
         "reason": "Names a competitor in a comparison with no linked verified comparison fact.",
         "checkedAt": "2026-09-27T13:00:00Z"},
    ]

    # A throwaway in-memory database so the real checker can run.
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = Session(engine)
    for b in BRANDS:
        session.add(Brand(brand_id=b["brandId"], name=b["name"], is_client=b["isClient"], billing_tier=b["billingTier"]))
    for p in products:
        session.add(Product(product_id=p["productId"], brand_id=p["brandId"], name=p["name"], price=p["price"],
                            currency=p["currency"], availability=p["availability"], specs=p["specs"],
                            return_policy_days=p["returnPolicyDays"], updated_at=p["updatedAt"],
                            price_history=[PREVIOUS_PRICE[p["productId"]]], features=[]))
    session.commit()
    catalog = Catalog(session)

    answer_ids = free_ids("ans", {a["answerId"] for a in answers}, 3, start=40)
    claim_ids = free_ids("clm", {c["claimId"] for c in claims}, 3, start=1)
    incident_ids = free_ids("inc", {i["incidentId"] for i in incidents}, 2, start=1)
    kestrel = [p for p in products if p["brandId"] == "brand_001"]
    competitors = [p for p in products if p["brandId"] != "brand_001"]
    new_audit = []

    def add_answer(text: str, captured: datetime, assistant_id: str, expected_rule: str | None, decide) -> None:
        """Store an answer, run the checker on it, and store its claims, incidents and audit entries.

        decide(handling, owner) -> (status, resolved datetime, resolvedBy, falseAlarm) for each new incident.
        """
        mentions = [b for b in ("brand_001", "brand_002", "brand_003")
                    if any(p["name"] in text for p in products if p["brandId"] == b) or brand_name[b] in text]
        order = sorted(mentions, key=lambda b: min(
            [text.find(p["name"]) for p in products if p["brandId"] == b and p["name"] in text] +
            ([text.find(brand_name[b])] if brand_name[b] in text else [])))
        answer_id = next(answer_ids)
        answers.append({"answerId": answer_id, "queryText": rng.choice(QUERIES), "assistantId": assistant_id,
                        "answerText": text, "brandMentioned": "brand_001" in order,
                        "rank": order.index("brand_001") + 1 if "brand_001" in order else None,
                        "sourceIds": sorted(rng.sample(cited_by_assistants, rng.randint(1, 3))),
                        "capturedAt": iso(captured), "source": "mock"})

        checked_at = captured + timedelta(minutes=5)
        extracted = extract_claims(text, catalog)
        new_audit.append((checked_at, "system", "system", "claim_extracted", answer_id,
                          f"Extracted {len(extracted)} claim(s) with plain regex and keyword rules."))
        found_rules = set()
        for c in extracted:
            r = check(c, catalog)
            found_rules.add(r.rule_id)
            claim_id = next(claim_ids)
            claims.append({"claimId": claim_id, "answerId": answer_id, "productId": c.product_id, "text": c.text,
                           "claimType": c.claim_type, "extractedValue": r.extracted_value,
                           "verifiedValue": r.verified_value, "status": r.status, "ruleId": r.rule_id,
                           "factId": r.fact_id, "reason": r.reason, "checkedAt": iso(checked_at)})
            new_audit.append((checked_at, "system", "system", "claim_checked", claim_id,
                              f"{r.rule_id or 'correct'}: {r.reason}"))
            if not r.rule_id or r.rule_id == "NO_FACT":
                continue  # NO_FACT is counted but never creates an incident

            severity, handling = severity_and_handling(r.rule_id, r.pct_off)
            product = session.get(Product, c.product_id) if c.product_id else None
            summary, ai_said, verified_fact, fix = describe(c, r, product, assistant_name[assistant_id])
            owner = owner_for[r.rule_id]
            incident_id = next(incident_ids)
            created = checked_at
            status, resolved, by, false_alarm = decide(handling, owner, created)
            incidents.append({
                "incidentId": incident_id, "claimId": claim_id, "answerId": answer_id, "productId": c.product_id,
                "ruleId": r.rule_id, "severity": severity, "handling": handling, "status": status,
                "summary": summary, "aiSaid": ai_said, "verifiedFact": verified_fact,
                "proposedFix": None if handling == "escalate" else fix, "ownerId": owner["ownerId"],
                "ownerName": owner["name"], "falseAlarm": false_alarm, "createdAt": iso(created),
                "resolvedAt": iso(resolved), "resolvedBy": by})
            new_audit.append((created, "system", "system", "incident_created", incident_id,
                              f"{r.rule_id} ({severity}) from {claim_id}. Owner: {owner['name']}."))
            if handling == "auto_fix":
                new_audit.append((resolved, "system", "system", "auto_fix_applied", incident_id, fix))
            elif handling == "escalate":
                new_audit.append((created + timedelta(seconds=1), "system", "system", "escalated", incident_id,
                                  f"Escalated to {owner['name']}. No fix applied."))
                new_audit.append((resolved, owner["name"], "human", "resolved", incident_id,
                                  "Resolved by a human. Note: Reviewed with Legal; no public claim to correct."))
            elif status == "approved":
                new_audit.append((resolved, owner["name"], "human", "approved", incident_id,
                                  f"Approved. Fix applied: {fix}"))
            else:
                new_audit.append((resolved, owner["name"], "human", "rejected", incident_id,
                                  "Rejected as a false alarm. No fix applied." if false_alarm else
                                  "Rejected. No fix applied. Note: Low impact; source already corrected."))
        if expected_rule and expected_rule not in found_rules:
            raise AssertionError(f"Template for {expected_rule} was not detected by the checker: {text}")

    def older_outcome(handling, owner, created):
        """Older history: auto-fixes in seconds, human outcomes cycling through HUMAN_OUTCOMES."""
        if handling == "auto_fix":
            return "auto_fixed", created + timedelta(seconds=2), "system", False
        if handling == "human_approval":
            outcome = HUMAN_OUTCOMES[sum(1 for i in incidents if i["handling"] == "human_approval") % 5]
            return ("approved" if outcome == "approved" else "rejected",
                    created + timedelta(minutes=rng.randint(45, 360)), owner["name"],
                    outcome == "rejected_false_alarm")
        return "resolved", created + timedelta(minutes=rng.randint(180, 600)), owner["name"], False

    for k in range(GENERATED_ANSWERS):
        # Oldest first, from 29 to 9 days ago, so the last 7 days are set only by RECENT_REVIEWS
        # and the shared/mock examples.
        days_ago = 29 - (k * 21) // GENERATED_ANSWERS
        captured = (REFERENCE - timedelta(days=days_ago)).replace(hour=rng.randint(8, 20), minute=rng.choice([0, 15, 30, 45]))
        assistant_id = ASSISTANTS[k % 3]["assistantId"]
        about_kestrel = k < len(RULE_SCHEDULE) or rng.random() < KESTREL_ANSWER_SHARE
        # Errors get rarer over the month, matching the improving trend.
        if k < len(RULE_SCHEDULE):
            rule = RULE_SCHEDULE[k]
        elif about_kestrel:
            rule = rng.choice(RULE_SCHEDULE[:-1]) if rng.random() < 0.75 - 0.5 * (k / GENERATED_ANSWERS) else None
        else:
            rule = None

        sentences = []
        if about_kestrel:
            subject = rng.choice(kestrel)
            sentences.append(correct_sentence(rng, subject, brand_name[subject["brandId"]]))
            others = [x for x in products if x is not subject]
        else:
            subject, others = None, competitors
        for p in rng.sample(others, 2 if about_kestrel else 3):
            sentence = correct_sentence(rng, p, brand_name[p["brandId"]])
            if sentence not in sentences:  # no repeated sentences within one answer
                sentences.append(sentence)
        if about_kestrel and rng.random() < 0.3:
            sentences.append("The Kestrel Aero 14 is cheaper than the Novex Slate 14.")  # a supported comparison
        if rule:
            bad = wrong_sentence(rng, rule, subject, brand_name[subject["brandId"]], products)
            sentences.insert(rng.randint(1, len(sentences)), bad)
        add_answer(" ".join(sentences), captured, assistant_id, rule, older_outcome)

    # The last 7 days: human reviews that close in hours, no new false alarms (see RECENT_REVIEWS).
    for n, (days_ago, rule, outcome, minutes) in enumerate(RECENT_REVIEWS):
        captured = (REFERENCE - timedelta(days=days_ago)).replace(hour=rng.randint(8, 12), minute=rng.choice([0, 30]))
        subject = rng.choice(kestrel)
        rival = rng.choice(competitors)
        sentences = [correct_sentence(rng, rival, brand_name[rival["brandId"]]),
                     wrong_sentence(rng, rule, subject, brand_name[subject["brandId"]], products)]

        def recent_outcome(handling, owner, created, outcome=outcome, minutes=minutes, rule=rule):
            expected = "escalate" if outcome == "resolved" else "human_approval"
            if handling != expected:
                raise AssertionError(f"RECENT_REVIEWS {rule} got handling {handling}, expected {expected}")
            return outcome, created + timedelta(minutes=minutes), owner["name"], False

        add_answer(" ".join(sentences), captured, ASSISTANTS[n % 3]["assistantId"], rule, recent_outcome)

    # Every incident needs at least one audit entry (mock incidents inc_32 and inc_33 had none).
    audited = {e["targetId"] for e in audit} | {e[4] for e in new_audit}
    for i in incidents:
        if i["incidentId"] not in audited:
            created = datetime.fromisoformat(i["createdAt"].replace("Z", "+00:00"))
            new_audit.append((created, "system", "system", "incident_created", i["incidentId"],
                              f"{i['ruleId']} ({i['severity']}) from {i['claimId']}. Owner: {i['ownerName']}."))
            if i["status"] == "auto_fixed":
                new_audit.append((created + timedelta(seconds=2), "system", "system", "auto_fix_applied",
                                  i["incidentId"], i["proposedFix"]))

    audit_ids = free_ids("aud", {e["auditId"] for e in audit}, 3, start=1)
    for at, actor, actor_type, action, target, details in sorted(new_audit, key=lambda e: (e[0], e[3], e[4])):
        audit.append({"auditId": next(audit_ids), "timestamp": iso(at), "actor": actor, "actorType": actor_type,
                      "action": action, "targetId": target, "details": details})

    return {
        "brands": BRANDS, "products": products, "assistants": ASSISTANTS, "sources": sources, "owners": owners,
        "answers": sorted(answers, key=lambda a: a["answerId"]),
        "claims": sorted(claims, key=lambda c: c["claimId"]),
        "incidents": sorted(incidents, key=lambda i: i["incidentId"]),
        "audit": sorted(audit, key=lambda e: e["auditId"]),
        "daily_metrics": daily,
    }


# File name -> wrapper key (same layout as backend/tests/fixtures/).
FILES = {"brands": "brands", "products": "products", "assistants": "assistants", "sources": "sources",
         "owners": "owners", "answers": "answers", "claims": "claims", "incidents": "incidents",
         "audit": "entries", "daily_metrics": "daily"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=SEED_DIR / "data")
    args = parser.parse_args()
    data = build()
    args.out.mkdir(parents=True, exist_ok=True)
    for name, key in FILES.items():
        text = json.dumps({key: data[name]}, indent=2, ensure_ascii=False) + "\n"
        (args.out / f"{name}.json").write_text(text, encoding="utf-8", newline="\n")
    counts = ", ".join(f"{len(data[n])} {n}" for n in FILES)
    print(f"Wrote {args.out}: {counts}")


if __name__ == "__main__":
    main()
