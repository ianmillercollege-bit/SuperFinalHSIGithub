"""Onboarding: "Connect your catalog" (BACKEND_CONTRACT.md v1.3 section 7b).

Creates a brand account from a product list: the brand (isClient, billingTier "starter"; never
returned), its products, a Brand Data Owner covering every ruleId, an owner API key for /client/* and
brandId use, and a brand_onboarded audit entry. The connector ranks the new products immediately and
neutrally. Everything lives in SQLite until the next restart, by design.
"""

import re
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

import constants as C
from db import ApiKey, Brand, Owner, Product, get_db
from ids import next_id
from schemas import OnboardIn, OnboardOut
from services.checker import audit
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
