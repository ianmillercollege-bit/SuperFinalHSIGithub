"""Catalog at scale (BACKEND_CONTRACT.md v1.4.1 section 7c, "Seed at scale"; DECISIONS.md #34).

Source of truth: backend/seed/source/greek_god_tech_companies.xlsx (the backend engineer's spreadsheet,
committed with its temporary passwords removed). Everything here is deterministic: the same sheet always
gives the same seed files.

Writes data/catalog/:
  brands.json       the sheet's 150 companies as brands (seed-only isClient / billingTier)
  profiles.json     a company profile for all 153 brands (Kestrel, Arcton and Novex included)
  products.json     the sheet's 1,500 products (category, subcategory, specs, price history, VDL fields)
  comparisons.json  the sheet's "Verified Comparisons" as comparison facts
  users.json        demo users (cirqo-demo works for everyone; v1.7: sheet admins also carry the hash of
                    their company's own password and, if renamed, their original sheet email as an alias)
  owners.json, answers.json, claims.json, incidents.json, audit.json, daily_metrics.json
                    dashboard data for every sheet company (each row carries its brandId)

Company names that match real brands are renamed to other fictional Greek-myth names (RENAMES).
"""

import hashlib
import json
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import openpyxl

SOURCE = Path(__file__).resolve().parent / "source" / "greek_god_tech_companies.xlsx"
# v1.7 (decision #41): hashes of the sheet companies' own passwords, written once by hash_sheet_passwords.py.
PASSWORD_HASHES = Path(__file__).resolve().parent / "source" / "sheet_password_hashes.json"
REFERENCE = datetime(2026, 9, 29, 18, 0, 0, tzinfo=timezone.utc)

# Greek-myth names that are also well-known real brands -> other fictional Greek-myth names.
RENAMES = {"Nike": "Nikaia", "Hermes": "Herse", "Aura": "Aurai", "Nyx": "Nykteis", "Eos": "Eosphoros",
           "Iris": "Thaumas", "Atlas": "Pleione", "Apollo": "Delphyne", "Kratos": "Alastor"}
CATEGORY = {"Headphones & Earbuds": "headphones", "Laptops": "laptops", "Smartphones & Tablets": "phones_tablets",
            "Computer Hardware": "computer_hardware"}
SPEC_COLUMNS = {"Processor": "processor", "Graphics": "graphics", "Display Type": "displayType",
                "Resolution": "resolution", "Ports": "ports", "Operating System": "operatingSystem",
                "Battery Life (hrs)": "batteryHours", "Weight (g)": "weightG"}
# The sheet's product-detail columns (added after v1.4.1), camelCased into specs like the columns above.
# Offer Count, Lowest Offer Price and Secondary Offers describe the Offers tab and are not product facts.
DETAIL_COLUMNS = {"Product Family": "productFamily", "Model": "model", "Variant": "variant",
                  "Generation (Model Year)": "generation", "Product Tier": "productTier", "Tier Basis": "tierBasis",
                  "MSRP": "msrp", "Commercial Status": "commercialStatus", "ANC": "anc",
                  "Codec Support": "codecSupport", "Driver": "driver", "Microphone": "microphone",
                  "Water Resistance": "waterResistance", "Refresh Rate (Hz)": "refreshRateHz",
                  "Camera System": "cameraSystem", "Charging": "charging", "Cellular": "cellular",
                  "Form Factor": "formFactor", "Compatibility": "compatibility"}
COMPARISON_KINDS = {"Lower price": "price", "Lighter": "weight", "Longer battery": "battery"}
INCIDENT_RULES = ["PRICE_MISMATCH", "PRICE_OUTDATED", "SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH",
                  "POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL"]
FIRST_NAMES = ["Ava", "Ben", "Chloe", "Diego", "Elena", "Farid", "Gia", "Hugo", "Ines", "Jonah", "Kai", "Lila",
               "Mateo", "Nadia", "Omar", "Priya", "Quinn", "Rosa", "Samir", "Tara", "Uma", "Victor", "Wen", "Yara",
               "Zane", "Amara", "Bruno", "Celia", "Dmitri", "Esme"]
LAST_NAMES = ["Alvarez", "Brooks", "Chen", "Duarte", "Evans", "Fischer", "Garcia", "Hale", "Ito", "Jensen", "Khan",
              "Lindqvist", "Moreau", "Nakamura", "Okafor", "Park", "Quintero", "Rossi", "Singh", "Tanaka", "Ueda",
              "Varga", "Walsh", "Xu", "Young", "Zimmer", "Adeyemi", "Bauer", "Castro", "Dubois"]
CITIES = ["Austin, TX", "Denver, CO", "Portland, OR", "Raleigh, NC", "Madison, WI", "Boise, ID", "Tucson, AZ",
          "Columbus, OH", "Pittsburgh, PA", "Salt Lake City, UT", "Minneapolis, MN", "Richmond, VA", "Omaha, NE",
          "Sacramento, CA", "Albuquerque, NM", "Burlington, VT", "Ann Arbor, MI", "Chattanooga, TN"]
CATEGORY_TAGLINES = {"headphones": "Headphones and earbuds", "laptops": "Laptops", "phones_tablets": "Phones and tablets",
                     "computer_hardware": "PC parts and accessories"}

# Kestrel, Arcton and Novex keep all their data; they gain a profile and users.
ORIGINAL_PROFILES = {
    "brand_001": {"tagline": "Thin laptops for students and travelers", "categories": ["laptops"], "hqCity": "Austin, TX",
                  "founded": 2016, "employees": 140, "ceo": {"name": "Priya Natarajan"},
                  "website": "https://www.kestrel.example"},
    "brand_002": {"tagline": "Big-screen laptops for creators and gamers", "categories": ["laptops"],
                  "hqCity": "Seattle, WA", "founded": 2009, "employees": 820, "ceo": {"name": "Marcus Hale"},
                  "website": "https://www.arcton.example"},
    "brand_003": {"tagline": "Reliable everyday laptops", "categories": ["laptops"], "hqCity": "Boston, MA",
                  "founded": 2012, "employees": 410, "ceo": {"name": "Hannah Osei"},
                  "website": "https://www.novex.example"},
}
ORIGINAL_USERS = [  # (userId, name, username, role, title, brandId)
    ("usr_001", "Maria Lopez", "maria.lopez@kestrel.example", "Brand Data Owner", None, "brand_001"),
    ("usr_002", "Sam Lee", "sam.lee@kestrel.example", "Viewer", None, "brand_001"),
    ("usr_003", "Priya Shah", "priya.shah@arcton.example", "Brand Data Owner", None, "brand_002"),
    ("usr_004", "Tom Becker", "tom.becker@arcton.example", "Trust and Safety Lead", None, "brand_002"),
    ("usr_005", "Lena Ortiz", "lena.ortiz@novex.example", "Brand Data Owner", None, "brand_003"),
    ("usr_006", "Marcus Webb", "marcus.webb@novex.example", "Trust and Safety Lead", None, "brand_003"),
    ("usr_007", "Grace Kim", "grace.kim@cirqo.example", "CIRQO Staff", "Trust and Safety Lead", None),
    ("usr_008", "Dev Patel", "dev.patel@cirqo.example", "CIRQO Staff", "Product Owner", None),
]
ESCALATED_COMPANIES = 5  # the first five sheet companies also get an open safety/legal escalation


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rng_for(key: str) -> random.Random:
    return random.Random(int(hashlib.sha256(key.encode()).hexdigest()[:12], 16))


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def rename(text, renames=RENAMES):
    """Replace real-brand company names inside any text (names, other names, comparisons)."""
    if not isinstance(text, str):
        return text
    for old, new in renames.items():
        text = re.sub(rf"\b{old}\b", new, text)
        text = re.sub(rf"\b{old.upper()}\b", new.upper(), text)
    return text


def rename_email(email: str) -> str:
    local, _, domain = email.partition("@")
    for old, new in RENAMES.items():
        if domain.startswith(old.lower()):
            domain = new.lower() + domain[len(old):]
        if local.startswith(old.lower() + "."):
            local = new.lower() + local[len(old):]
    return f"{local}@{domain}"


def read_table(wb, sheet: str, min_filled: int = 8) -> list[dict]:
    rows = list(wb[sheet].iter_rows(values_only=True))
    hi = next(i for i, r in enumerate(rows) if sum(v is not None for v in r) >= min_filled)
    header = rows[hi]
    return [{header[j]: v for j, v in enumerate(r) if header[j] is not None}
            for r in rows[hi + 1:] if r[0] is not None]


def split_list(value, sep) -> list[str]:
    return [v.strip() for v in str(value or "").split(sep) if v.strip() and v.strip() != "N/A"]


def money(value: float) -> str:
    return f"${value:.2f}"


def build_catalog(data: dict, checker) -> dict[str, list[dict]]:
    """data: the main seed (for the original brands and products). checker: services.checker module."""
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    companies = read_table(wb, "Companies")
    details = read_table(wb, "Product Details")
    logins = {row["Company"]: row for row in read_table(wb, "Login Credentials", 6)}
    sheet_hashes = {a["loginEmail"]: a["passwordHash"]
                    for a in json.loads(PASSWORD_HASHES.read_text(encoding="utf-8"))["accounts"]}

    # ---- Brands, profiles, users ----------------------------------------------------------------
    brands, profiles, users, owners = [], [], [], []
    brand_of_company, website_of = {}, {}
    for brand_id, profile in ORIGINAL_PROFILES.items():
        profiles.append({"brandId": brand_id, **profile})
    for i, c in enumerate(sorted(companies, key=lambda c: int(c["#"])), start=1):
        name = rename(c["Company"])
        brand_id = f"brand_{3 + i:03d}"
        brand_of_company[c["Company"]] = brand_id
        g = rng_for("company:" + c["Company"])
        login = logins[c["Company"]]
        email = rename_email(login["Login Email"])
        website = "https://www." + email.split("@", 1)[1]
        website_of[brand_id] = website
        category = CATEGORY[c["Category"]]
        brands.append({"brandId": brand_id, "name": name, "isClient": False,
                       "billingTier": g.choice(["starter", "starter", "growth", "growth", "enterprise"])})
        focus = split_list(c["Use-Case Focus"], ",")
        profiles.append({
            "brandId": brand_id,
            "tagline": f"{CATEGORY_TAGLINES[category]} for {', '.join(focus[:2]) or 'everyday use'}",
            "categories": [category], "hqCity": g.choice(CITIES), "founded": g.randint(1998, 2022),
            "employees": g.choice([35, 60, 120, 240, 480, 900, 1600, 3200]),
            "ceo": {"name": f"{g.choice(FIRST_NAMES)} {g.choice(LAST_NAMES)}"}, "website": website,
            "otherNames": [rename(n) for n in split_list(c["Other Names (short names, misspellings)"], ";")],
            "warranty": c["Standard Warranty"],
            "certifications": split_list(c["Company Certifications"], ","),
            "useCaseFocus": focus,
            "productCategories": split_list(c["Product Categories"], ","),
        })
        admin_name = f"{g.choice(FIRST_NAMES)} {g.choice(LAST_NAMES)}"
        sheet_email = login["Login Email"].strip().lower()
        users.append({"userId": f"usr_{100 + i:03d}", "name": admin_name, "username": email,
                      "role": "Brand Data Owner", "title": None, "brandId": brand_id,  # sheet "Brand Admin"
                      "sheetPasswordHash": sheet_hashes[sheet_email],
                      "aliases": [sheet_email] if sheet_email != email else []})
        owners.append({"ownerId": f"own_{1000 + i}", "name": admin_name, "role": "Brand Data Owner",
                       "incidentTypes": list(INCIDENT_RULES), "brandId": brand_id})
    users = [{"userId": u, "name": n, "username": un, "role": r, "title": t, "brandId": b}
             for u, n, un, r, t, b in ORIGINAL_USERS] + users

    # ---- Products ---------------------------------------------------------------------------------
    products = []
    sku_to_product = {}
    alias_count: dict[str, int] = {}
    for d in details:
        for alias in split_list(d["Other Names (short names, misspellings)"], ";"):
            alias_count[rename(alias).lower()] = alias_count.get(rename(alias).lower(), 0) + 1
    for d in details:
        brand_id = brand_of_company[d["Company"]]
        product_id = "prod_" + d["SKU"]
        sku_to_product[d["SKU"]] = product_id
        category = CATEGORY[d["Category"]]
        name = rename(d["Product"])
        specs = {}
        for column, key in SPEC_COLUMNS.items():
            value = d.get(column)
            if value not in (None, "", "N/A"):
                specs[key] = value
        for column, key in DETAIL_COLUMNS.items():
            value = d.get(column)
            if value not in (None, "", "N/A"):
                specs[key] = value
        specs["warranty"] = d["Warranty"]
        specs["certifications"] = split_list(d["Certifications"], ",")
        specs["useCaseTags"] = split_list(d["Use-Case Tags"], ",")
        # Only other names that belong to exactly this product: a shared nickname would blame the wrong brand.
        specs["otherNames"] = [rename(a) for a in split_list(d["Other Names (short names, misspellings)"], ";")
                               if alias_count[rename(a).lower()] == 1]
        if category == "laptops":
            specs.update({"ramGb": d["RAM (GB) (generated)"], "storageGb": d["Storage (GB) (generated)"],
                          "screenInches": d["Screen Size (in) (generated)"],
                          "touchscreen": d["Touchscreen (generated)"] == "Yes",
                          "weightLb": round(float(d["Weight (g)"]) / 453.592, 1)})
        elif category == "phones_tablets" and d.get("RAM (GB) (generated)") not in (None, "", "N/A"):
            # The sheet now fills these for phones and tablets too, so the checker can verify them.
            specs.update({"ramGb": d["RAM (GB) (generated)"], "storageGb": d["Storage (GB) (generated)"],
                          "screenInches": d["Screen Size (in) (generated)"],
                          "touchscreen": d["Touchscreen (generated)"] == "Yes"})
        changed = d["Price Changed On (generated)"]
        website = website_of[brand_id]
        page = slug(name.split(" ", 1)[1] if " " in name else name)
        products.append({
            "productId": product_id, "brandId": brand_id, "name": name, "price": float(d["Price"]),
            "currency": "USD", "availability": d["Availability (generated)"], "category": category,
            "subcategory": d["Product Category"], "specs": specs,
            "returnPolicyDays": int(d["Return Policy (days) (generated)"]),
            "updatedAt": f"{changed}T12:00:00Z", "factSource": "Manufacturer spec sheet",
            "factSourceUrl": f"{website}/{page}", "verifiedAt": "2026-09-28T12:00:00Z",
            "priceHistory": [{"price": float(d["Previous Price (generated)"]), "effectiveFrom": "2026-07-01",
                              "effectiveTo": changed},
                             {"price": float(d["Price"]), "effectiveFrom": changed, "effectiveTo": None}],
        })

    # ---- Verified comparisons -> comparison facts --------------------------------------------------
    comparisons, n = [], 0
    pattern = re.compile(r"^(.*?) than (.+?) \[([A-Z]+-\d+-\d+)\] \((.+)\)$")
    for d in details:
        for part in str(d["Verified Comparisons"] or "").split(";"):
            m = pattern.match(part.strip())
            if not m or m.group(1) not in COMPARISON_KINDS:
                continue
            n += 1
            comparisons.append({"factId": f"fact_c{n:04d}", "productId": sku_to_product[d["SKU"]],
                                "otherProductId": sku_to_product[m.group(3)], "attribute": COMPARISON_KINDS[m.group(1)],
                                "text": rename(part.strip())})

    catalog_rows = {"brands": brands, "profiles": profiles, "products": products, "comparisons": comparisons,
                    "users": users, "owners": owners}
    catalog_rows.update(build_dashboards(data, catalog_rows, checker))
    return catalog_rows


# ---- Dashboard data for every sheet company ------------------------------------------------------


def correct_sentences(p: dict, company: str) -> list[str]:
    s, name = p["specs"], p["name"]
    out = [f"The {name} costs {money(p['price'])}.",
           {"in_stock": f"The {name} is in stock.", "low_stock": f"The {name} has limited stock.",
            "out_of_stock": f"The {name} is out of stock."}[p["availability"]],
           f"{company} offers a {p['returnPolicyDays']}-day return policy on the {name}."]
    if isinstance(s.get("batteryHours"), (int, float)):
        out.append(f"The {name} is rated for {int(s['batteryHours'])} hours of battery life.")
    return out


def mistake(kind: str, p: dict, company: str) -> tuple[str, str]:
    name = p["name"]
    if kind == "price_low":
        return f"The {name} costs {money(p['price'] * 0.97)}.", "PRICE_MISMATCH"
    if kind == "price_high":
        return f"The {name} costs {money(p['price'] * 0.8)}.", "PRICE_MISMATCH"
    if kind == "availability":
        return (f"The {name} is in stock." if p["availability"] == "out_of_stock" else f"The {name} is out of stock.",
                "AVAILABILITY_MISMATCH")
    if kind == "invented":
        return f"The {name} includes solar charging.", "INVENTED_FEATURE"
    if kind == "policy":
        days = 90 if p["returnPolicyDays"] != 90 else 60
        return f"{company} offers a {days}-day return policy on the {name}.", "POLICY_MISMATCH"
    if kind == "safety":
        return f"The {name} is certified child-safe.", "SAFETY_LEGAL"
    raise ValueError(kind)


# (days ago, mistake, outcome for a human-reviewed incident)
SCHEDULE = [(28, "price_low", None), (25, "comparison", None), (21, "availability", None),
            (17, "invented", "approved"), (13, None, None), (9, "policy", "rejected"), (5, "safety", "escalated"),
            (2, "price_high", "pending_approval")]
TREND_KEYS = ("accuracyRate", "hallucinationRate", "visibilityRate")


def build_dashboards(data: dict, catalog_rows: dict, checker) -> dict[str, list[dict]]:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from db import Base, Brand, ComparisonFact, Product

    # A throwaway database with the whole catalog, so the real checker can run.
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = Session(engine)
    brand_rows = data["brands"] + catalog_rows["brands"]
    for b in brand_rows:
        session.add(Brand(brand_id=b["brandId"], name=b["name"], is_client=b["isClient"], billing_tier=b["billingTier"]))
    for p in data["products"] + catalog_rows["products"]:
        session.add(Product(product_id=p["productId"], brand_id=p["brandId"], name=p["name"], price=p["price"],
                            currency="USD", availability=p["availability"], specs=p["specs"],
                            return_policy_days=p["returnPolicyDays"], updated_at=p["updatedAt"],
                            fact_source=p["factSource"], fact_source_url=p["factSourceUrl"],
                            verified_at=p["verifiedAt"], price_history=[h["price"] for h in p["priceHistory"]
                                                                        if h["price"] != p["price"]],
                            features=[], category=p.get("category", "laptops"),
                            subcategory=p.get("subcategory", "Laptop")))
    for f in catalog_rows["comparisons"]:
        session.add(ComparisonFact(fact_id=f["factId"], product_id=f["productId"],
                                   other_product_id=f["otherProductId"], attribute=f["attribute"], text=f["text"]))
    session.commit()
    catalog = checker.Catalog(session)
    brand_name = {b["brandId"]: b["name"] for b in brand_rows}
    owner_of = {o["brandId"]: o for o in catalog_rows["owners"]}
    by_brand: dict[str, list[dict]] = {}
    for p in catalog_rows["products"]:
        by_brand.setdefault(p["brandId"], []).append(p)
    price_facts = {}
    for f in catalog_rows["comparisons"]:
        if f["attribute"] == "price":
            price_facts.setdefault(f["productId"], f)
    third_party = [s["sourceId"] for s in data["sources"] if s["sourceId"] != "src_brand"]
    assistants = [a["assistantId"] for a in data["assistants"]]
    assistant_name = {a["assistantId"]: a["name"] for a in data["assistants"]}
    dates = [d["date"] for d in data["daily_metrics"]]
    out = {k: [] for k in ("answers", "claims", "incidents", "audit", "daily_metrics")}

    for k, brand in enumerate(catalog_rows["brands"], start=1):
        brand_id, company = brand["brandId"], brand["name"]
        g = rng_for("dashboard:" + brand_id)
        own = sorted(by_brand[brand_id], key=lambda p: p["productId"])
        same_category = [p for p in catalog_rows["products"]
                         if p["category"] == own[0]["category"] and p["brandId"] != brand_id]
        owner = owner_of[brand_id]
        ids = {"ans": iter(range(1000 + k * 20, 1000 + k * 20 + 20)), "clm": iter(range(10000 + k * 50, 10000 + k * 50 + 50)),
               "inc": iter(range(1000 + k * 10, 1000 + k * 10 + 10))}
        audit = []

        def add_answer(text, captured, assistant_id, expected, outcome, mentions_brand=True):
            answer_id = f"ans_{next(ids['ans'])}"
            order = checker.brand_mentions(text, catalog)
            out["answers"].append({
                "answerId": answer_id, "queryText": f"best {own[0]['subcategory'].lower()} for "
                                                    f"{g.choice(own[0]['specs']['useCaseTags'] or ['everyday use'])}",
                "assistantId": assistant_id, "answerText": text, "brandMentioned": brand_id in order,
                "rank": order.index(brand_id) + 1 if brand_id in order else None,
                "sourceIds": sorted(g.sample(third_party, g.randint(1, 3))), "capturedAt": iso(captured),
                "source": "mock", "brandId": brand_id})
            checked_at = captured + timedelta(minutes=5)
            extracted = checker.extract_claims(text, catalog)
            audit.append((checked_at, "system", "system", "claim_extracted", answer_id,
                          f"Extracted {len(extracted)} claim(s) with plain regex and keyword rules."))
            found = set()
            for c in extracted:
                r = checker.check(c, catalog)
                found.add(r.rule_id)
                claim_id = f"clm_{next(ids['clm'])}"
                out["claims"].append({"claimId": claim_id, "answerId": answer_id, "productId": c.product_id,
                                      "text": c.text, "claimType": c.claim_type, "extractedValue": r.extracted_value,
                                      "verifiedValue": r.verified_value, "status": r.status, "ruleId": r.rule_id,
                                      "factId": r.fact_id, "reason": r.reason, "checkedAt": iso(checked_at)})
                audit.append((checked_at, "system", "system", "claim_checked", claim_id,
                              f"{r.rule_id or 'correct'}: {r.reason}"))
                if not r.rule_id or r.rule_id == "NO_FACT":
                    continue
                severity, handling = checker.severity_and_handling(r.rule_id, r.pct_off, legacy_price_auto_fix=True)  # seeded history
                product = session.get(Product, c.product_id)
                summary, ai_said, verified_fact, fix = checker.describe(c, r, product, assistant_name[assistant_id])
                incident_id = f"inc_{next(ids['inc'])}"
                status, resolved, by, false_alarm = "auto_fixed", checked_at + timedelta(seconds=2), "system", False
                if handling != "auto_fix":
                    if outcome in ("pending_approval", "escalated"):
                        status, resolved, by = outcome, None, None
                    elif handling == "escalate":
                        status, resolved, by = "resolved", checked_at + timedelta(hours=4), owner["name"]
                    else:
                        status, resolved, by = outcome, checked_at + timedelta(minutes=g.randint(60, 300)), owner["name"]
                        false_alarm = outcome == "rejected" and k % 3 == 0
                out["incidents"].append({
                    "incidentId": incident_id, "claimId": claim_id, "answerId": answer_id, "productId": c.product_id,
                    "ruleId": r.rule_id, "severity": severity, "handling": handling, "status": status,
                    "summary": summary, "aiSaid": ai_said, "verifiedFact": verified_fact,
                    "proposedFix": None if handling == "escalate" else fix, "ownerId": owner["ownerId"],
                    "ownerName": owner["name"], "falseAlarm": false_alarm, "createdAt": iso(checked_at),
                    "resolvedAt": iso(resolved) if resolved else None, "resolvedBy": by, "brandId": brand_id})
                audit.append((checked_at, "system", "system", "incident_created", incident_id,
                              f"{r.rule_id} ({severity}) from {claim_id}. Owner: {owner['name']}."))
                if status == "auto_fixed":
                    audit.append((resolved, "system", "system", "auto_fix_applied", incident_id, fix))
                elif handling == "escalate":
                    audit.append((checked_at + timedelta(seconds=1), "system", "system", "escalated", incident_id,
                                  f"Escalated to {owner['name']}. No fix applied."))
                    if status == "resolved":
                        audit.append((resolved, owner["name"], "human", "resolved", incident_id,
                                      "Resolved by a human. Note: Reviewed with Legal; no public claim to correct."))
                elif status in ("approved", "rejected"):
                    audit.append((resolved, owner["name"], "human", status, incident_id,
                                  f"Approved. Fix applied: {fix}" if status == "approved" else
                                  "Rejected as a false alarm. No fix applied." if false_alarm else
                                  "Rejected. No fix applied. Note: Low impact; source already corrected."))
            if expected and expected not in found:
                raise AssertionError(f"{company}: the checker did not find {expected} in: {text}")

        for i, (days_ago, kind, outcome) in enumerate(SCHEDULE):
            captured = (REFERENCE - timedelta(days=days_ago)).replace(hour=g.randint(9, 15), minute=g.choice([0, 30]))
            p = own[i % len(own)]
            sentences = g.sample(correct_sentences(p, company), 2)
            expected = None
            if kind == "comparison":
                fact = next((price_facts[q["productId"]] for q in own if q["productId"] in price_facts), None)
                if fact:
                    a = next(q for q in own if q["productId"] == fact["productId"])
                    b = catalog.by_id[fact["otherProductId"]]
                    sentences.append(f"The {a['name']} is cheaper than the {b.name}.")  # backed by a verified fact
            elif kind == "safety" and k > ESCALATED_COMPANIES:
                pass  # only the first companies carry an open escalation
            elif kind:
                bad, expected = mistake(kind, p, company)
                sentences.insert(1, bad)
            add_answer(" ".join(sentences), captured, assistants[i % 3], expected, outcome)

        for j in range(2):  # tracked prompts where only other companies are named
            captured = (REFERENCE - timedelta(days=26 - j * 12)).replace(hour=11, minute=15)
            others = g.sample(same_category, 2)
            text = " ".join(g.choice(correct_sentences(q, brand_name[q["brandId"]])) for q in others)
            add_answer(text, captured, assistants[(j + 1) % 3], None, None, mentions_brand=False)

        start = {"accuracyRate": round(g.uniform(0.55, 0.75), 2), "hallucinationRate": round(g.uniform(0.07, 0.15), 3),
                 "visibilityRate": round(g.uniform(0.3, 0.6), 2)}
        end = {"accuracyRate": min(0.95, round(start["accuracyRate"] + g.uniform(0.12, 0.22), 2)),
               "hallucinationRate": round(start["hallucinationRate"] * g.uniform(0.3, 0.5), 3),
               "visibilityRate": round(start["visibilityRate"] + g.uniform(0.04, 0.1), 2)}
        for i, day in enumerate(dates):
            f = i / (len(dates) - 1)
            row = {"date": day, "brandId": brand_id}
            for key in TREND_KEYS:
                noise = 0.0 if i in (0, len(dates) - 1) else g.uniform(-0.006, 0.006) * (0.2 if key == "hallucinationRate" else 1)
                row[key] = round(start[key] + (end[key] - start[key]) * f + noise, 3 if key == "hallucinationRate" else 2)
            row["claimsChecked"] = g.randint(20, 60)
            row["incidentsOpened"] = max(0, round(5 - 4 * f + g.uniform(-1, 1)))
            out["daily_metrics"].append(row)

        for n, (at, actor, actor_type, action, target, details) in enumerate(sorted(audit, key=lambda e: (e[0], e[3], e[4]))):
            out["audit"].append({"auditId": f"aud_{100000 + k * 100 + n}", "timestamp": iso(at), "actor": actor,
                                 "actorType": actor_type, "action": action, "targetId": target, "details": details,
                                 "brandId": brand_id})
    return out
