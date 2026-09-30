"""Business dashboard: products, visibility, answers, sources, checker, claims, trust metrics, report.

v1.3 section 7b: visibility, answers, sources, claims, trust metrics and report take an optional
?brandId= (default brand_001), resolved and checked by services/scope.py.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from db import Answer, Assistant, Brand, Claim, ComparisonFact, Product, get_db
from ids import next_id
from schemas import (AnswersOut, CheckerRunIn, CheckerRunOut, ClaimsOut, ProductDetailOut, ProductsOut, ReportOut, SourcesOut,
                     TrustOut, VisibilityOut)
from services import ai_client, metrics
from services.ai_client import source_label
from services.checker import Catalog, brand_mentions, run_on_answer
from services.scope import brand_scope, visible_answer_ids
from timeutil import now_iso

router = APIRouter(tags=["Dashboard"])

SPEC_KEYS = ("ramGb", "storageGb", "screenInches", "batteryHours", "weightLb", "touchscreen")

DAYS = Query(30, ge=1, le=30)
LIMIT = Query(50, ge=1, le=100)


def product_specs(p: Product) -> dict:
    """Laptops: the six contract specs (null when not on file) plus any extra keys. Other categories:
    the catalog's own spec columns (v1.4.1), only those on file."""
    if p.category != "laptops":
        return dict(p.specs)
    return {**{k: p.specs.get(k) for k in SPEC_KEYS}, **{k: v for k, v in p.specs.items() if k not in SPEC_KEYS}}


def product_out(p: Product, brands: dict[str, Brand]) -> dict:
    # Built field by field so seed-only fields (isClient, billingTier, priceHistory) can never leak.
    brand = brands.get(p.brand_id)
    return {"productId": p.product_id, "brandId": p.brand_id, "brandName": brand.name if brand else "",
            "verified": bool(brand.opted_in) if brand else False,  # v1.5 section 7d
            "name": p.name, "price": p.price, "currency": p.currency, "availability": p.availability,
            "category": p.category, "subcategory": p.subcategory,
            "specs": product_specs(p),
            "returnPolicyDays": p.return_policy_days, "updatedAt": p.updated_at,
            "factSource": p.fact_source, "factSourceUrl": p.fact_source_url, "verifiedAt": p.verified_at,
            "condition": p.condition, "communityPledge": p.community_pledge}


@router.get("/products", response_model=ProductsOut)
def products(category: Literal["laptops", "headphones", "phones_tablets", "computer_hardware"] | None = None,
             brand_id: str | None = Query(None, alias="brandId"),
             opted_in: bool | None = Query(None, alias="optedIn"), db=Depends(get_db)):
    # v1.4.1: both filters optional. An unknown brandId is a 404 like every other brand filter.
    if brand_id is not None and db.get(Brand, brand_id) is None:
        raise HTTPException(404, f"Brand {brand_id} does not exist.")
    brands = {b.brand_id: b for b in db.scalars(select(Brand)).all()}
    q = select(Product).order_by(Product.product_id)
    if category:
        q = q.where(Product.category == category)
    if brand_id:
        q = q.where(Product.brand_id == brand_id)
    rows = db.scalars(q).all()
    if opted_in is not None:  # v1.5 section 7d
        rows = [p for p in rows if bool(brands[p.brand_id].opted_in) is opted_in]
    return {"products": [product_out(p, brands) for p in rows]}


@router.get("/products/{product_id}", response_model=ProductDetailOut)
def product_detail(product_id: str, db=Depends(get_db)):
    """v1.7: one product with its verified comparisons, so an assistant asked for depth has facts to quote."""
    p = db.get(Product, product_id)
    if p is None:
        raise HTTPException(404, f"Product {product_id} does not exist.")
    brands = {b.brand_id: b for b in db.scalars(select(Brand)).all()}
    facts = db.scalars(select(ComparisonFact).where(ComparisonFact.product_id == product_id)
                       .order_by(ComparisonFact.fact_id)).all()
    others = {o.product_id: o.name for o in db.scalars(
        select(Product).where(Product.product_id.in_([f.other_product_id for f in facts]))).all()} if facts else {}
    out = product_out(p, brands)
    out["comparisons"] = [{"factId": f.fact_id, "otherProductId": f.other_product_id,
                           "otherProductName": others.get(f.other_product_id, ""), "attribute": f.attribute,
                           "text": f.text} for f in facts]
    return out


# ---- Visibility and answers -----------------------------------------------------------------


@router.get("/visibility/summary", response_model=VisibilityOut)
def visibility_summary(days: int = DAYS, brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return metrics.visibility_summary(db, days, brand_id)


def answer_out(a: Answer, assistants: dict[str, str], brand_id: str, catalog: Catalog) -> dict:
    mentioned, rank = a.brand_mentioned, a.rank
    if a.brand_id != brand_id:
        # A brand-neutral answer: brandMentioned and rank are computed for the brand being viewed.
        order = brand_mentions(a.answer_text, catalog)
        rank = order.index(brand_id) + 1 if brand_id in order else None
        mentioned = rank is not None
    return {"answerId": a.answer_id, "queryText": a.query_text, "assistantId": a.assistant_id,
            "assistantName": assistants.get(a.assistant_id, a.assistant_id), "answerText": a.answer_text,
            "brandMentioned": mentioned, "rank": rank, "sourceIds": a.source_ids,
            "capturedAt": a.captured_at, "source": a.source}


@router.get("/answers", response_model=AnswersOut)
def answers(assistant_id: str | None = Query(None, alias="assistantId"), limit: int = LIMIT,
            brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    q = select(Answer).where(Answer.answer_id.in_(visible_answer_ids(brand_id)))         .order_by(Answer.captured_at.desc(), Answer.answer_id.desc())
    if assistant_id:
        q = q.where(Answer.assistant_id == assistant_id)
    assistants = {a.assistant_id: a.name for a in db.scalars(select(Assistant)).all()}
    catalog = Catalog(db)
    return {"answers": [answer_out(a, assistants, brand_id, catalog) for a in db.scalars(q.limit(limit)).all()]}


@router.get("/sources", response_model=SourcesOut)
def sources(days: int = DAYS, brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return {"sources": metrics.sources_summary(db, days, brand_id)}


# ---- Checker ------------------------------------------------------------------------------------


@router.post("/checker/run", response_model=CheckerRunOut)
def checker_run(body: CheckerRunIn, db=Depends(get_db)):
    has_id, has_text = body.answer_id is not None, body.answer_text is not None
    if has_id == has_text:
        raise HTTPException(422, "Send exactly one of: answerId, or answerText with assistantId and queryText.")

    if has_id:
        answer = db.get(Answer, body.answer_id)
        if answer is None:
            raise HTTPException(404, f"Answer {body.answer_id} does not exist.")
    else:
        if not body.answer_text.strip():
            raise HTTPException(422, "answerText must not be empty.")
        if not body.assistant_id or not (body.query_text or "").strip():
            raise HTTPException(422, "answerText requires assistantId and queryText.")
        if db.get(Assistant, body.assistant_id) is None:
            raise HTTPException(422, f"Unknown assistantId '{body.assistant_id}'.")
        catalog = Catalog(db)
        client_ids = catalog.client_brand_ids
        order = brand_mentions(body.answer_text, catalog)
        client_rank = next((i + 1 for i, b in enumerate(order) if b in client_ids), None)
        answer = Answer(answer_id=next_id(db, Answer.answer_id, "ans"), query_text=body.query_text,
                        assistant_id=body.assistant_id, answer_text=body.answer_text,
                        brand_mentioned=client_rank is not None, rank=client_rank, source_ids=[],
                        captured_at=now_iso(), source=source_label())
        db.add(answer)
        db.flush()

    # AI (when MOCK_MODE=false) only extracts claims; plain code judges them (contract section 3).
    extracted, source, extracted_by = ai_client.extract(answer.answer_text, Catalog(db))
    if not has_id:
        answer.source = source
    claims, created = run_on_answer(db, answer, extracted, extracted_by)
    return {"answerId": answer.answer_id, "claims": claims, "incidentsCreated": created, "source": source}


@router.get("/claims", response_model=ClaimsOut)
def claims(status: Literal["correct", "incorrect", "outdated", "unverifiable"] | None = None,
           answer_id: str | None = Query(None, alias="answerId"), limit: int = LIMIT,
           brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    q = select(Claim).where(Claim.answer_id.in_(visible_answer_ids(brand_id)))         .order_by(Claim.checked_at.desc(), Claim.claim_id.desc())
    if status:
        q = q.where(Claim.status == status)
    if answer_id:
        q = q.where(Claim.answer_id == answer_id)
    return {"claims": db.scalars(q.limit(limit)).all()}


# ---- Trust metrics and report ---------------------------------------------------------------


@router.get("/metrics/trust", response_model=TrustOut)
def trust(days: int = DAYS, brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return metrics.trust_metrics(db, days, brand_id)


@router.get("/report", response_model=ReportOut)
def report(days: int = DAYS, brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return metrics.report(db, days, brand_id)
