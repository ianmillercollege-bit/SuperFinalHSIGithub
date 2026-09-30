"""Community program (BACKEND_CONTRACT.md v1.6 section 7e).

Companies pledge refurbished and surplus units. Community Partner organizations browse one
cross-company catalog of pledged units, with the same verified facts as everything else, and request
units; the brand approves by a named owner. CIRQO never verifies an individual's income or need and
stores nothing about recipients: a request says what the units are for, never who gets them.

Also here:
- load_community: seed rows from community.json (called by seed_loader.py).
- connector_gate: `constraints.includeRefurbished` for the connector. Refurbished and surplus products
  are hidden from connector calls unless the assistant asks for them.
"""

import json
from pathlib import Path

from fastapi import Depends, HTTPException, Request
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session, with_loader_criteria

import constants as C
from db import Brand, CommunityOrg, CommunityRequest, Product, User, get_db
from ids import next_id
from services.checker import Catalog, Extracted, audit, check, num
from services.passwords import hash_password
from services.session import STAFF
from timeutil import now_iso

PARTNER = "Community Partner"
DATA_OWNER = "Brand Data Owner"
CONDITIONS = ("new", "refurbished", "surplus")
PUBLIC_LISTING = "Public listing (not verified by brand)"  # v1.5 factSource for not-opted-in brands

# ---------------------------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------------------------


def load_community(rows: dict, folder: Path, moved) -> None:
    """Add the community seed (<folder>/community.json) to the rows seed_loader is about to insert."""
    path = folder / "community.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    changes = {p["productId"]: p for p in data.get("products", [])}
    for row in rows[Product]:  # every product row gets both keys: bulk inserts need the same columns
        change = changes.get(row["product_id"], {})
        row["condition"] = change.get("condition", "new")
        row["community_pledge"] = change.get("communityPledge")
    for row in rows[User]:
        row.setdefault("org_id", None)
    # Every demo password is cirqo-demo: reuse the hash the loader already made (hashing is deliberately slow).
    demo_hash = next((u["password_hash"] for u in rows[User]), None) or hash_password(C.DEMO_PASSWORD)
    for o in data.get("orgs", []):
        rows[CommunityOrg].append(dict(org_id=o["orgId"], name=o["name"], kind=o["kind"]))
    for u in data.get("users", []):
        rows[User].append(dict(user_id=u["userId"], username=u["username"].lower(), name=u["name"], role=u["role"],
                               title=u.get("title"), brand_id=None, org_id=u["orgId"], password_hash=demo_hash))
    for r in data.get("requests", []):
        rows[CommunityRequest].append(dict(
            request_id=r["requestId"], product_id=r["productId"], brand_id=r["brandId"], org_id=r["orgId"],
            units=r["units"], purpose=r["purpose"], status=r["status"], created_at=moved(r["createdAt"]),
            decided_at=moved(r.get("decidedAt")), decided_by=r.get("decidedBy"), note=r.get("note")))


# ---------------------------------------------------------------------------------------------
# Connector: includeRefurbished
# ---------------------------------------------------------------------------------------------

HIDE_NOT_NEW = "cirqo_hide_not_new"


async def connector_gate(request: Request, db=Depends(get_db)) -> None:
    """Router dependency on /connector/*: unless the body says constraints.includeRefurbished = true, this
    request's database session only sees new products. get_db is cached per request, so the route
    handler gets this same session."""
    include = False
    if request.method == "POST":
        try:
            body = await request.json()
        except ValueError:
            body = None  # the route itself answers 422
        constraints = body.get("constraints") if isinstance(body, dict) else None
        include = isinstance(constraints, dict) and constraints.get("includeRefurbished") is True
    db.info[HIDE_NOT_NEW] = not include


@event.listens_for(Session, "do_orm_execute")
def _hide_not_new(state) -> None:
    if state.is_select and state.session.info.get(HIDE_NOT_NEW):
        state.statement = state.statement.options(
            with_loader_criteria(Product, Product.condition == "new", include_aliases=True))


def condition_sentences(p: Product) -> list[str]:
    """What an answer must say about a refurbished or surplus product (checked like any fact)."""
    if p.condition == "new":
        return []
    sentences = [f"The {p.name} is {p.condition}."]
    months = (p.community_pledge or {}).get("warrantyMonths")
    if months:
        sentences.append(f"The {p.name} is covered for {num(months)} months under the brand's community pledge.")
    return sentences


# ---------------------------------------------------------------------------------------------
# Who may do what
# ---------------------------------------------------------------------------------------------


def require_partner_or_staff(user: User | None) -> User:
    if user is None or user.role not in (PARTNER, STAFF):
        raise HTTPException(403, "The community catalog is for Community Partner and CIRQO Staff logins.")
    return user


def require_partner(user: User | None) -> User:
    if user is None or user.role != PARTNER or not user.org_id:
        raise HTTPException(403, "Only a Community Partner login can request units.")
    return user


# ---------------------------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------------------------


def units_left(p: Product) -> int:
    pledge = p.community_pledge or {}
    return max(0, int(pledge.get("unitsPledged", 0)) - int(pledge.get("unitsPlaced", 0)))


def pledge_out(p: Product) -> dict | None:
    pledge = p.community_pledge
    if not pledge:
        return None
    return {"unitsPledged": pledge["unitsPledged"], "unitsPlaced": pledge["unitsPlaced"],
            "conditionNotes": pledge.get("conditionNotes"), "warrantyMonths": pledge.get("warrantyMonths")}


def facts_for(p: Product, catalog: Catalog) -> list[dict]:
    """Price, condition and pledge warranty, each checked by the checker against the verified record.
    Built as claims about this exact product, so a product name shared by two products cannot confuse it."""
    stated = [(f"Price: ${p.price:.2f}.", "price", "price", None, f"{p.price:.2f}"),
              (f"Condition: {p.condition}.", "feature", "spec", "condition", p.condition)]
    months = (p.community_pledge or {}).get("warrantyMonths")
    if months:
        stated.append((f"Covered for {num(months)} months under the brand's community pledge.",
                       "feature", "spec", "warrantyMonths", float(months)))
    facts = []
    for text, claim_type, kind, attr, value in stated:
        r = check(Extracted(text, claim_type, kind, p.product_id, value=value, attr=attr), catalog)
        facts.append({"text": text, "claimStatus": r.status, "factId": r.fact_id})
    return facts


def catalog_items(db, category: str | None, brand_id: str | None, condition: str | None, limit: int) -> list[dict]:
    q = select(Product).where(Product.community_pledge.is_not(None))
    if category:
        q = q.where(Product.category == category)
    if brand_id:
        q = q.where(Product.brand_id == brand_id)
    if condition:
        q = q.where(Product.condition == condition)
    products = db.scalars(q).all()
    # Neutral order: most units still available first, then name. Never who the brand is or what it pays.
    products.sort(key=lambda p: (-units_left(p), p.name.lower(), p.product_id))
    products = products[:limit]
    catalog = Catalog(db)
    brands = {b.brand_id: b.name for b in db.scalars(select(Brand)).all()}
    return [{"productId": p.product_id, "name": p.name, "brandId": p.brand_id, "brandName": brands.get(p.brand_id, ""),
             "category": p.category, "condition": p.condition, "price": p.price,
             "verified": p.fact_source != PUBLIC_LISTING, "communityPledge": pledge_out(p),
             "facts": facts_for(p, catalog)} for p in products]


# ---------------------------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------------------------


def request_out(db, r: CommunityRequest) -> dict:
    org = db.get(CommunityOrg, r.org_id)
    product = db.get(Product, r.product_id)
    return {"requestId": r.request_id, "status": r.status, "productId": r.product_id,
            "productName": product.name if product else None, "brandId": r.brand_id,
            "partner": {"orgId": r.org_id, "orgName": org.name if org else r.org_id},
            "units": r.units, "purpose": r.purpose, "createdAt": r.created_at,
            "decidedAt": r.decided_at, "decidedBy": r.decided_by, "note": r.note}


def create_request(db, user: User, product_id: str, units: int, purpose: str) -> CommunityRequest:
    p = db.get(Product, product_id)
    if p is None:
        raise HTTPException(404, f"Product {product_id} does not exist.")
    if not p.community_pledge:
        raise HTTPException(403, f"No units of the {p.name} are pledged to the community program.")
    left = units_left(p)
    if units > left:
        raise HTTPException(422, f"units: only {left} unit(s) of the {p.name} are still available.")
    org = db.get(CommunityOrg, user.org_id)
    r = CommunityRequest(request_id=next_id(db, CommunityRequest.request_id, "creq"), product_id=p.product_id,
                         brand_id=p.brand_id, org_id=user.org_id, units=units, purpose=purpose,
                         status="pending_approval", created_at=now_iso())
    db.add(r)
    db.flush()
    audit(db, user.name, "human", "community_request", r.request_id,
          f"{org.name if org else user.org_id} requested {units} unit(s) of the {p.name}: {purpose}")
    db.commit()
    return r


def list_requests(db, user: User | None, status: str | None, limit: int) -> list[CommunityRequest]:
    q = select(CommunityRequest)
    if user is None:
        raise HTTPException(403, "Sign in as a Community Partner, a brand or CIRQO Staff to see requests.")
    if user.role == PARTNER:
        q = q.where(CommunityRequest.org_id == user.org_id)
    elif user.brand_id:
        q = q.where(CommunityRequest.brand_id == user.brand_id)
    elif user.role != STAFF:
        raise HTTPException(403, "Sign in as a Community Partner, a brand or CIRQO Staff to see requests.")
    if status:
        q = q.where(CommunityRequest.status == status)
    q = q.order_by(CommunityRequest.created_at.desc(), CommunityRequest.request_id.desc()).limit(limit)
    return db.scalars(q).all()


def decide(db, user: User | None, request_id: str, approve: bool, note: str | None) -> CommunityRequest:
    r = db.get(CommunityRequest, request_id)
    if r is None:
        raise HTTPException(404, f"Community request {request_id} does not exist.")
    if user is None or user.role != DATA_OWNER or user.brand_id != r.brand_id:
        raise HTTPException(403, "Only the product brand's Brand Data Owner can approve or reject this request.")
    if r.status != "pending_approval":
        raise HTTPException(409, f"Community request {request_id} is {r.status}, not pending_approval.")
    p = db.get(Product, r.product_id)
    if approve:
        if p is None or units_left(p) < r.units:
            raise HTTPException(409, f"Only {units_left(p) if p else 0} unit(s) are still available; "
                                     f"this request needs {r.units}.")
        # Reassign (not mutate) so SQLAlchemy sees the JSON column change.
        p.community_pledge = {**p.community_pledge, "unitsPlaced": p.community_pledge["unitsPlaced"] + r.units}
    r.status = "approved" if approve else "rejected"
    r.decided_at, r.decided_by, r.note = now_iso(), user.name, note
    action = "community_approved" if approve else "community_rejected"
    name = p.name if p else r.product_id
    audit(db, user.name, "human", action, r.request_id,
          f"{user.name} {r.status} {r.units} unit(s) of the {name}." + (f" Note: {note}" if note else ""))
    db.commit()
    return r


# ---------------------------------------------------------------------------------------------
# Impact
# ---------------------------------------------------------------------------------------------


def impact(db, brand_id: str) -> dict:
    products = db.scalars(select(Product).where(Product.brand_id == brand_id,
                                                Product.community_pledge.is_not(None))).all()
    by_category: dict[str, dict] = {}
    for p in products:
        row = by_category.setdefault(p.category, {"category": p.category, "unitsPledged": 0, "unitsPlaced": 0})
        row["unitsPledged"] += p.community_pledge["unitsPledged"]
        row["unitsPlaced"] += p.community_pledge["unitsPlaced"]
    partners = db.scalar(select(func.count(func.distinct(CommunityRequest.org_id)))
                         .where(CommunityRequest.brand_id == brand_id, CommunityRequest.status == "approved"))
    pending = db.scalar(select(func.count()).select_from(CommunityRequest)
                        .where(CommunityRequest.brand_id == brand_id, CommunityRequest.status == "pending_approval"))
    rows = sorted(by_category.values(), key=lambda r: r["category"])
    return {"brandId": brand_id, "unitsPledged": sum(r["unitsPledged"] for r in rows),
            "unitsPlaced": sum(r["unitsPlaced"] for r in rows), "partnersServed": partners or 0,
            "requestsPending": pending or 0, "byCategory": rows}
