"""Onboarding: "Connect your catalog" (BACKEND_CONTRACT.md v1.3 section 7b).

Creates a brand account from a product list: the brand (isClient, billingTier "starter"; never
returned), its products, a Brand Data Owner covering every ruleId, an owner API key for /client/* and
brandId use, and a brand_onboarded audit entry. The connector ranks the new products immediately and
neutrally. Everything lives in SQLite until the next restart, by design.
"""

import re
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select

import constants as C
from db import ApiKey, Brand, DailyMetric, Incident, Owner, Product, User, get_db
from ids import next_id
from schemas import BrandProfileOut, BrandsOut, OnboardIn, OnboardOut
from services.checker import audit
from services.session import STAFF, VIEWER, optional_user, required_user
from timeutil import now_iso

router = APIRouter(prefix="/brands", tags=["Brand accounts"])

NOTE = "Demo data. Resets when the server restarts."


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "brand"


def default_page(brand_name: str, product_name: str) -> str:
    """A fictional page on the brand's own .example domain, e.g. https://www.lumenaudio.example/buds-2."""
    brand_words = set(slug(brand_name).split("-"))
    words = slug(product_name).split("-")
    while len(words) > 1 and words[0] in brand_words:  # "Lumen Buds 2" by "Lumen Audio" -> "buds-2"
        words.pop(0)
    return f"https://www.{slug(brand_name).replace('-', '')}.example/{'-'.join(words)}"


def new_api_key(db, brand_name: str) -> str:
    while True:
        key = f"fd_{slug(brand_name)}_{secrets.token_hex(2)}"
        if db.get(ApiKey, key) is None:
            return key


@router.post("/onboard", response_model=OnboardOut, status_code=201)
def onboard(body: OnboardIn, db=Depends(get_db)):
    brand_name, owner_name = body.brand_name.strip(), body.owner_name.strip()
    existing = {b.name.strip().casefold() for b in db.scalars(select(Brand)).all()}
    if brand_name.casefold() in existing:
        raise HTTPException(409, f"A brand named '{brand_name}' already exists.")

    # Product names must be unique in the catalog so claims can be matched to one product.
    taken = {p.name.strip().casefold() for p in db.scalars(select(Product)).all()}
    for p in body.products:
        name = p.name.strip().casefold()
        if name in taken:
            raise HTTPException(422, f"A product named '{p.name.strip()}' is already in the catalog or listed twice.")
        taken.add(name)

    at = now_iso()
    brand = Brand(brand_id=next_id(db, Brand.brand_id, "brand"), name=brand_name, is_client=True,
                  billing_tier="starter")
    db.add(brand)
    db.flush()

    for p in body.products:
        db.add(Product(product_id=next_id(db, Product.product_id, "prod"), brand_id=brand.brand_id,
                       name=p.name.strip(), price=p.price, currency="USD", availability=p.availability,
                       category=p.category,
                       subcategory=p.subcategory or C.CATEGORY_DEFAULT_SUBCATEGORY[p.category],
                       specs=dict(p.specs), return_policy_days=p.return_policy_days, updated_at=at,
                       fact_source=p.fact_source,
                       fact_source_url=p.fact_source_url or default_page(brand_name, p.name),
                       verified_at=at, price_history=[], features=[]))
        db.flush()

    owner = Owner(owner_id=next_id(db, Owner.owner_id, "own"), name=owner_name, role="Brand Data Owner",
                  incident_types=list(C.INCIDENT_RULE_IDS), brand_id=brand.brand_id)
    db.add(owner)
    key = ApiKey(api_key=new_api_key(db, brand_name), brand_id=brand.brand_id, role="owner")
    db.add(key)
    db.flush()

    audit(db, owner_name, "human", "brand_onboarded", brand.brand_id,
          f"{owner_name} connected the {brand_name} catalog: {len(body.products)} product(s). {NOTE}", at)
    db.commit()
    return {"brandId": brand.brand_id, "brandName": brand.name, "apiKey": key.api_key,
            "productsCreated": len(body.products),
            "owners": [{"ownerId": owner.owner_id, "name": owner.name, "role": owner.role}],
            "connectorReady": True, "note": NOTE}


# ---- Company profiles and the CIRQO Staff overview (v1.4 section 7c) --------------------------------


def brand_categories(db, brand: Brand) -> list[str]:
    listed = (brand.profile or {}).get("categories")
    if listed:
        return listed
    return sorted(set(db.scalars(select(Product.category).where(Product.brand_id == brand.brand_id)).all()))


@router.get("", response_model=BrandsOut)
def all_brands(user: User = Depends(required_user), db=Depends(get_db)):
    """Every brand at a glance, for CIRQO Staff only (a brand's own token gets 403)."""
    if user.role != STAFF:
        raise HTTPException(403, "Only CIRQO Staff can see every brand.")
    counts = dict(db.execute(select(Product.brand_id, func.count()).group_by(Product.brand_id)).all())
    open_ = dict(db.execute(select(Incident.brand_id, func.count())
                            .where(Incident.status.in_(("pending_approval", "escalated"))).group_by(Incident.brand_id)).all())
    escalated = dict(db.execute(select(Incident.brand_id, func.count()).where(Incident.status == "escalated")
                                .group_by(Incident.brand_id)).all())
    trend: dict[str, list[DailyMetric]] = {}
    for row in db.scalars(select(DailyMetric).order_by(DailyMetric.brand_id, DailyMetric.date)).all():
        trend.setdefault(row.brand_id, []).append(row)

    def last7(brand_id: str, key: str) -> float:  # "current" = the last 7 days, as in /metrics/trust
        rows = trend.get(brand_id, [])[-7:]
        return round(sum(getattr(r, key) for r in rows) / len(rows), 2) if rows else 0.0

    brands = db.scalars(select(Brand).order_by(Brand.brand_id)).all()
    return {"brands": [{"brandId": b.brand_id, "brandName": b.name, "categories": brand_categories(db, b),
                        "productCount": counts.get(b.brand_id, 0), "visibilityRate": last7(b.brand_id, "visibility_rate"),
                        "openIncidents": open_.get(b.brand_id, 0), "escalatedIncidents": escalated.get(b.brand_id, 0),
                        "accuracyRate": last7(b.brand_id, "accuracy_rate")} for b in brands]}


@router.get("/{brand_id}", response_model=BrandProfileOut, response_model_exclude_none=True)
def brand_profile(brand_id: str, user: User | None = Depends(optional_user), db=Depends(get_db)):
    """A company's public profile. `plan` only for the brand itself (or CIRQO Staff); another brand's token
    gets 403. Never returns isClient."""
    brand = db.get(Brand, brand_id)
    if brand is None:
        raise HTTPException(404, f"Brand {brand_id} does not exist.")
    own = user is not None and (user.brand_id == brand_id or user.role == STAFF)
    if user is not None and not own:
        raise HTTPException(403, "A brand's token can only open its own profile.")
    profile = brand.profile or {}
    admins = db.scalars(select(User).where(User.brand_id == brand_id, User.role != VIEWER).order_by(User.user_id)).all()
    return {"brandId": brand.brand_id, "brandName": brand.name, "tagline": profile.get("tagline"),
            "categories": brand_categories(db, brand), "hqCity": profile.get("hqCity"),
            "founded": profile.get("founded"), "employees": profile.get("employees"), "ceo": profile.get("ceo"),
            "website": profile.get("website"),
            "admins": [{"userId": u.user_id, "name": u.name, "role": u.role} for u in admins],
            "productCount": db.scalar(select(func.count()).select_from(Product).where(Product.brand_id == brand_id)),
            "plan": brand.billing_tier if own and brand.billing_tier in ("starter", "growth", "enterprise") else None}
