"""Inventory: the signed-in brand's own products, editable (BACKEND_CONTRACT.md v1.9).

Reading follows the dashboard's brand scoping. Writing needs the brand's own login token (not a Viewer) or
its owner API key, so one brand can never change another's catalog. Edits go straight to the verified
catalog the checker and the connector read, and every change is written to the audit log.
"""

import constants as C
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select

from db import ApiKey, Brand, Product, User, get_db
from ids import next_id
from routers.brands import default_page
from routers.dashboard import product_out
from schemas import (InventoryImportIn, InventoryImportOut, InventoryOut, InventoryPatch, ProductOut)
from services.checker import audit
from services.session import STAFF, VIEWER, optional_user
from timeutil import now_iso

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def writer_brand(user: User | None = Depends(optional_user),
                 x_api_key: str | None = Header(None, alias="X-API-Key"), db=Depends(get_db)) -> tuple[str, str]:
    """(brandId, who) for a caller allowed to change a catalog: a brand login that is not a Viewer, or an
    owner API key. 401 when neither is sent, 403 for a Viewer or a viewer key."""
    if user is not None:
        if user.role == VIEWER or not user.brand_id:
            raise HTTPException(403, "Only a brand's own team (not a Viewer or CIRQO Staff) can change its inventory.")
        return user.brand_id, user.name
    key = db.get(ApiKey, x_api_key) if x_api_key else None
    if key is None:
        raise HTTPException(401, "Sign in as the brand (or send its API key in X-API-Key) to change inventory.")
    if key.role != "owner":
        raise HTTPException(403, "Only an owner key can change inventory.")
    return key.brand_id, "Brand owner"


def summary_for(db, brand_id: str | None) -> dict:
    """Counts over one brand's catalog, or over every brand's when brand_id is None (CIRQO Staff)."""
    def scoped(query):
        return query.where(Product.brand_id == brand_id) if brand_id else query
    by_category = dict(db.execute(scoped(select(Product.category, func.count())).group_by(Product.category)).all())
    by_stock = dict(db.execute(scoped(select(Product.availability, func.count())).group_by(Product.availability)).all())
    return {"total": sum(by_category.values()), "inStock": by_stock.get("in_stock", 0),
            "lowStock": by_stock.get("low_stock", 0), "outOfStock": by_stock.get("out_of_stock", 0),
            "byCategory": by_category}


def read_scope(brand_id: str | None = Query(None, alias="brandId"), user: User | None = Depends(optional_user),
               db=Depends(get_db)) -> str | None:
    """The brand being read. A brand login decides it; otherwise ?brandId=; CIRQO Staff with neither see every
    company (None); anyone else defaults to Kestrel like the dashboard. 404 for an unknown brand."""
    if user is not None and user.brand_id:
        return user.brand_id
    if brand_id is not None:
        if db.get(Brand, brand_id) is None:
            raise HTTPException(404, f"Brand {brand_id} does not exist.")
        return brand_id
    return None if user is not None and user.role == STAFF else C.DEFAULT_BRAND_ID


@router.get("", response_model=InventoryOut)
def inventory(q: str | None = Query(None, max_length=100), category: str | None = None,
              availability: str | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
              brand_id: str | None = Depends(read_scope), db=Depends(get_db)):
    """The brand's products (every company's for CIRQO Staff), newest changes first, one page at a time."""
    brands = {b.brand_id: b for b in db.scalars(select(Brand)).all()}
    query = select(Product)
    if brand_id:
        query = query.where(Product.brand_id == brand_id)
    if q and q.strip():
        query = query.where(func.lower(Product.name).contains(q.strip().lower()))
    if category:
        query = query.where(Product.category == category)
    if availability:
        query = query.where(Product.availability == availability)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Product.updated_at.desc(), Product.product_id).limit(limit).offset(offset)).all()
    return {"items": [product_out(p, brands) for p in rows], "total": total, "summary": summary_for(db, brand_id)}


def own_product(db, product_id: str, brand_id: str) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.brand_id != brand_id:  # another brand's product looks like it does not exist
        raise HTTPException(404, f"Product {product_id} is not in your inventory.")
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: str, body: InventoryPatch, who: tuple[str, str] = Depends(writer_brand),
                   db=Depends(get_db)):
    brand_id, actor = who
    product = own_product(db, product_id, brand_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(422, "Send at least one field to change.")
    notes = []
    if "price" in changes and changes["price"] != product.price:
        product.price_history = [*(product.price_history or []), product.price]
        notes.append(f"price {product.price:g} to {changes['price']:g}")
        product.price = changes["price"]
    if "availability" in changes and changes["availability"] != product.availability:
        notes.append(f"availability {product.availability} to {changes['availability']}")
        product.availability = changes["availability"]
    if "category" in changes and changes["category"] != product.category:
        product.category = changes["category"]
        notes.append(f"category to {product.category}")
        if "subcategory" not in changes:
            product.subcategory = C.CATEGORY_DEFAULT_SUBCATEGORY[product.category]
    if "subcategory" in changes:
        product.subcategory = changes["subcategory"].strip() or C.CATEGORY_DEFAULT_SUBCATEGORY[product.category]
    if "return_policy_days" in changes and changes["return_policy_days"] != product.return_policy_days:
        notes.append(f"return days {product.return_policy_days} to {changes['return_policy_days']}")
        product.return_policy_days = changes["return_policy_days"]
    if "specs" in changes:
        product.specs = {**(product.specs or {}), **changes["specs"]}
        notes.append("specs")
    at = now_iso()
    product.updated_at = at
    product.verified_at = at
    audit(db, actor, "human", "inventory_updated", product.product_id,
          f"{actor} changed {product.name}: {', '.join(notes) or 'details'}.", at)
    db.commit()
    return product_out(product, {brand_id: db.get(Brand, brand_id)})


@router.delete("/{product_id}", status_code=204)
def remove_product(product_id: str, who: tuple[str, str] = Depends(writer_brand), db=Depends(get_db)):
    brand_id, actor = who
    product = own_product(db, product_id, brand_id)
    audit(db, actor, "human", "inventory_removed", product.product_id, f"{actor} removed {product.name} from the catalog.")
    db.delete(product)
    db.commit()


@router.post("/import", response_model=InventoryImportOut)
def import_products(body: InventoryImportIn, who: tuple[str, str] = Depends(writer_brand), db=Depends(get_db)):
    """Adds new products and updates the ones whose name is already in the brand's catalog. Every product in
    the file is applied in one transaction; a name that belongs to another brand is skipped and reported."""
    brand_id, actor = who
    brand = db.get(Brand, brand_id)
    mine = {p.name.strip().casefold(): p for p in db.scalars(select(Product).where(Product.brand_id == brand_id))}
    others = {n.strip().casefold() for n in db.scalars(select(Product.name).where(Product.brand_id != brand_id))}
    at = now_iso()
    created = updated = 0
    skipped: list[str] = []
    seen: set[str] = set()
    for p in body.products:
        name = p.name.strip()
        key = name.casefold()
        if key in seen:  # the same product listed twice in one file: the first row wins
            continue
        seen.add(key)
        if key in others:
            skipped.append(name)
            continue
        existing = mine.get(key)
        if existing is not None:
            if p.price != existing.price:
                existing.price_history = [*(existing.price_history or []), existing.price]
                existing.price = p.price
            existing.availability = p.availability
            existing.category = p.category
            existing.subcategory = p.subcategory or existing.subcategory
            existing.return_policy_days = p.return_policy_days
            existing.specs = {**(existing.specs or {}), **p.specs}
            existing.updated_at = existing.verified_at = at
            updated += 1
        else:
            db.add(Product(product_id=next_id(db, Product.product_id, "prod"), brand_id=brand_id, name=name,
                           price=p.price, currency="USD", availability=p.availability, category=p.category,
                           subcategory=p.subcategory or C.CATEGORY_DEFAULT_SUBCATEGORY[p.category],
                           specs=dict(p.specs), return_policy_days=p.return_policy_days, updated_at=at,
                           fact_source=p.fact_source, fact_source_url=p.fact_source_url or default_page(brand.name, name),
                           verified_at=at, price_history=[], features=[]))
            db.flush()
            created += 1
    audit(db, actor, "human", "inventory_imported", brand_id,
          f"{actor} uploaded a spreadsheet: {created} product(s) added, {updated} updated, {len(skipped)} skipped.", at)
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "total": summary_for(db, brand_id)["total"]}
