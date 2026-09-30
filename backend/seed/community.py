"""Community program seed (BACKEND_CONTRACT.md v1.6 section 7e): product condition, brand pledges,
the three partner organizations and their logins, and a history of requests.

Reads the catalog generate.py has just written (<out>/products.json, <out>/brands.json and
<out>/catalog/) and writes <out>/community.json. Deterministic: a fixed random seed.

What it produces:
- About one product in eight is `refurbished` or `surplus`. Opted-in brands (v1.5: isClient or
  optedIn; until that flag is seeded, Kestrel, Arcton, Novex and the 15 lowest-id sheet companies of
  each category) pledge units on their refurbished and surplus products, at least 150 pledged products.
- Three fictional Community Partner organizations, one login each (password cirqo-demo).
- Every brand with pledges has at least one approved (placed) request, so its impact tile is not empty.
  `unitsPlaced` on each pledge is the sum of its approved requests.
- No data about any recipient: a request says what the units are for, never who gets them.

Usage (from the repo root or backend/):  python backend/seed/community.py [--out DIR]
"""

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

RANDOM_SEED = 20260930
REFERENCE = datetime(2026, 9, 27, 12, 0, 0, tzinfo=timezone.utc)  # before the newest seeded event
OPTED_IN_PER_CATEGORY = 15
MIN_PLEDGED = 150
PLEDGE_SHARE_OPTED_IN = 0.26  # of an opted-in brand's products
CONDITION_SHARE_OTHERS = 0.03  # not-opted-in brands: public listings, some refurbished, never pledged
ORIGINAL_BRANDS = ("brand_001", "brand_002", "brand_003")
KESTREL_PLEDGE = "prod_004"

ORGS = [
    {"orgId": "org_01", "name": "Bexar Valley School District", "kind": "school_district",
     "contact": ("Rosa", "Delgado", "Technology Coordinator")},
    {"orgId": "org_02", "name": "Lone Star Veterans Network", "kind": "veterans_group",
     "contact": ("Marcus", "Webb", "Program Director")},
    {"orgId": "org_03", "name": "Bridgeway Community Tech", "kind": "nonprofit",
     "contact": ("Tessa", "Nguyen", "Operations Lead")},
]

PURPOSES = {
    "org_01": ["Units for {n} students in the fall cohort", "Classroom set for a middle school computer lab",
               "Loaner pool for students without a device at home"],
    "org_02": ["Job-search kits for the veterans transition program", "Devices for the telehealth check-in room",
               "Training lab for the certification course"],
    "org_03": ["Public computer lab at the community center", "Digital skills workshop for adult learners",
               "Refurbished device library for local families"],
}
NOTES = {
    "refurbished": ["Grade A, new battery", "Grade A, light cosmetic wear", "Grade B, minor scratches on the case",
                    "Factory refurbished, new charger and cable"],
    "surplus": ["New in box, prior-season stock", "New, open box", "Overstock, sealed"],
}
WARRANTY = {"refurbished": [6, 12, 12], "surplus": [12, 12, 24]}
UNITS = {"laptops": (10, 60), "headphones": (30, 150), "phones_tablets": (10, 60), "computer_hardware": (5, 40)}


def read(path: Path, key: str) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))[key]


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def slug(name: str) -> str:
    return "-".join("".join(ch if ch.isalnum() else " " for ch in name.lower()).split())


def opted_in_brands(brands: list[dict], profiles: dict[str, dict]) -> set[str]:
    if any("optedIn" in b for b in brands):
        return {b["brandId"] for b in brands if b.get("optedIn") or b.get("isClient")}
    chosen = {b["brandId"] for b in brands if b.get("isClient") or b["brandId"] in ORIGINAL_BRANDS}
    per_category: dict[str, list[str]] = {}
    for b in sorted(brands, key=lambda b: b["brandId"]):
        if b["brandId"] in ORIGINAL_BRANDS:
            continue
        category = (profiles.get(b["brandId"], {}).get("categories") or ["laptops"])[0]
        per_category.setdefault(category, []).append(b["brandId"])
    for ids in per_category.values():
        chosen.update(ids[:OPTED_IN_PER_CATEGORY])
    return chosen


def build(out: Path) -> dict:
    catalog = out / "catalog"
    brands = read(out / "brands.json", "brands") + read(catalog / "brands.json", "brands")
    products = read(out / "products.json", "products") + read(catalog / "products.json", "products")
    profiles = {p["brandId"]: p for p in read(catalog / "profiles.json", "profiles")}
    opted_in = opted_in_brands(brands, profiles)
    # Requests are decided by a named owner: the brand's first Brand Data Owner login.
    deciders: dict[str, str] = {}
    for u in read(catalog / "users.json", "users"):
        if u.get("brandId") and u["role"] == "Brand Data Owner":
            deciders.setdefault(u["brandId"], u["name"])
    rng = random.Random(RANDOM_SEED)

    changed, pledged = [], []
    for p in sorted(products, key=lambda p: p["productId"]):
        mine = p["brandId"] in opted_in
        share = PLEDGE_SHARE_OPTED_IN if mine else CONDITION_SHARE_OTHERS
        # The 12 original demo laptops stay new (the demo script's answers depend on them), except Kestrel's
        # Studio 15, always pledged so the default dashboard brand has a community story.
        if p["brandId"] in ORIGINAL_BRANDS and "-" not in p["productId"]:
            share = 1.0 if p["productId"] == KESTREL_PLEDGE else 0.0
        if rng.random() >= share:
            continue
        condition = "refurbished" if rng.random() < 0.6 else "surplus"
        pledge = None
        if mine:
            low, high = UNITS.get(p.get("category", "laptops"), (10, 60))
            pledge = {"unitsPledged": rng.randint(low, high) // 5 * 5 or 5, "unitsPlaced": 0,
                      "conditionNotes": rng.choice(NOTES[condition]), "warrantyMonths": rng.choice(WARRANTY[condition])}
            pledged.append((p, pledge))
        changed.append({"productId": p["productId"], "condition": condition, "communityPledge": pledge})
    assert len(pledged) >= MIN_PLEDGED, f"only {len(pledged)} pledged products; raise PLEDGE_SHARE_OPTED_IN"

    orgs, users = [], []
    for i, org in enumerate(ORGS):
        first, last, title = org["contact"]
        orgs.append({"orgId": org["orgId"], "name": org["name"], "kind": org["kind"]})
        users.append({"userId": f"usr_9{i + 1:02d}", "name": f"{first} {last}", "role": "Community Partner",
                      "title": title, "orgId": org["orgId"],
                      "username": f"{first.lower()}.{last.lower()}@{slug(org['name'])}.example"})

    requests = []

    def add(p: dict, pledge: dict, status: str) -> None:
        left = pledge["unitsPledged"] - pledge["unitsPlaced"]
        if left < 1:
            return
        org = rng.choice(ORGS)["orgId"]
        units = max(1, min(left, round(pledge["unitsPledged"] * rng.uniform(0.1, 0.35))))
        created = REFERENCE - timedelta(days=rng.randint(3, 38), hours=rng.randint(0, 9), minutes=rng.randint(0, 59))
        if status == "pending_approval":
            created = REFERENCE - timedelta(days=rng.randint(0, 2), hours=rng.randint(1, 9))
        decided = created + timedelta(days=rng.randint(1, 2), hours=rng.randint(0, 5))
        request = {"requestId": f"creq_{len(requests) + 1:03d}", "productId": p["productId"], "brandId": p["brandId"],
                   "orgId": org, "units": units, "purpose": rng.choice(PURPOSES[org]).format(n=units),
                   "status": status, "createdAt": iso(created), "decidedAt": None, "decidedBy": None, "note": None}
        if status != "pending_approval":
            request.update(decidedAt=iso(min(decided, REFERENCE)), decidedBy=deciders.get(p["brandId"], "Brand Data Owner"),
                           note="Approved. Pickup scheduled with the partner." if status == "approved"
                           else "Those units are committed to an earlier request.")
        if status == "approved":
            pledge["unitsPlaced"] += units
        requests.append(request)

    by_brand: dict[str, list[tuple[dict, dict]]] = {}
    for p, pledge in pledged:
        by_brand.setdefault(p["brandId"], []).append((p, pledge))
    for items in by_brand.values():  # every pledging brand has at least one placed request
        add(*items[0], "approved")
    for p, pledge in pledged:  # and the default dashboard brand has one waiting for its approval
        if p["productId"] == KESTREL_PLEDGE:
            add(p, pledge, "pending_approval")
    for p, pledge in pledged:
        roll = rng.random()
        if roll < 0.22:
            add(p, pledge, "approved")
        elif roll < 0.36:
            add(p, pledge, "pending_approval")
        elif roll < 0.42:
            add(p, pledge, "rejected")
    requests.sort(key=lambda r: r["createdAt"])
    for i, r in enumerate(requests):
        r["requestId"] = f"creq_{i + 1:03d}"

    return {"note": "Community program seed (contract v1.6 section 7e). Written by seed/community.py.",
            "orgs": orgs, "users": users, "products": changed, "requests": requests}


def write_community(out: Path) -> dict:
    data = build(out)
    text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
    (out / "community.json").write_text(text, encoding="utf-8", newline="\n")
    pledged = sum(1 for p in data["products"] if p["communityPledge"])
    print(f"Wrote {out / 'community.json'}: {len(data['products'])} refurbished or surplus products, "
          f"{pledged} pledged, {len(data['orgs'])} partners, {len(data['requests'])} requests")
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "data")
    write_community(parser.parse_args().out)
