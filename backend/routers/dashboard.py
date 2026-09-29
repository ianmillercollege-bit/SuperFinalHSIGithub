"""Business dashboard: products, visibility, answers, sources, checker, claims, trust metrics, report."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from db import Answer, Assistant, Brand, Claim, Product, get_db
from ids import next_id
from schemas import (AnswersOut, CheckerRunIn, CheckerRunOut, ClaimsOut, ProductsOut, ReportOut, SourcesOut,
                     TrustOut, VisibilityOut)
from services import ai_client, metrics
from services.ai_client import source_label
from services.checker import Catalog, brand_mentions, run_on_answer
from timeutil import now_iso

router = APIRouter(tags=["Dashboard"])

DAYS = Query(30, ge=1, le=30)
LIMIT = Query(50, ge=1, le=100)


def product_out(p: Product, brands: dict[str, str]) -> dict:
    # Built field by field so seed-only fields (isClient, billingTier, priceHistory) can never leak.
    return {"productId": p.product_id, "brandId": p.brand_id, "brandName": brands.get(p.brand_id, ""),
            "name": p.name, "price": p.price, "currency": p.currency, "availability": p.availability,
            "specs": {k: p.specs[k] for k in ("ramGb", "storageGb", "screenInches", "batteryHours", "weightLb",
                                              "touchscreen")},
            "returnPolicyDays": p.return_policy_days, "updatedAt": p.updated_at,
            "factSource": p.fact_source, "factSourceUrl": p.fact_source_url, "verifiedAt": p.verified_at}


@router.get("/products", response_model=ProductsOut)
def products(db=Depends(get_db)):
    brands = {b.brand_id: b.name for b in db.scalars(select(Brand)).all()}
    rows = db.scalars(select(Product).order_by(Product.product_id)).all()
    return {"products": [product_out(p, brands) for p in rows]}


# ---- Visibility and answers -----------------------------------------------------------------


def visibility(days: int, db) -> dict:
    return metrics.visibility_summary(db, days)


@router.get("/visibility/summary", response_model=VisibilityOut)
def visibility_summary(days: int = DAYS, db=Depends(get_db)):
    return visibility(days, db)


def answer_out(a: Answer, assistants: dict[str, str]) -> dict:
    return {"answerId": a.answer_id, "queryText": a.query_text, "assistantId": a.assistant_id,
            "assistantName": assistants.get(a.assistant_id, a.assistant_id), "answerText": a.answer_text,
            "brandMentioned": a.brand_mentioned, "rank": a.rank, "sourceIds": a.source_ids,
            "capturedAt": a.captured_at, "source": a.source}


@router.get("/answers", response_model=AnswersOut)
def answers(assistant_id: str | None = Query(None, alias="assistantId"), limit: int = LIMIT, db=Depends(get_db)):
    q = select(Answer).order_by(Answer.captured_at.desc(), Answer.answer_id.desc())
    if assistant_id:
        q = q.where(Answer.assistant_id == assistant_id)
    assistants = {a.assistant_id: a.name for a in db.scalars(select(Assistant)).all()}
    return {"answers": [answer_out(a, assistants) for a in db.scalars(q.limit(limit)).all()]}


@router.get("/sources", response_model=SourcesOut)
def sources(days: int = DAYS, db=Depends(get_db)):
    return {"sources": metrics.sources_summary(db, days)}


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
        if not body.assistant_id or not body.query_text:
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
           answer_id: str | None = Query(None, alias="answerId"), limit: int = LIMIT, db=Depends(get_db)):
    q = select(Claim).order_by(Claim.checked_at.desc(), Claim.claim_id.desc())
    if status:
        q = q.where(Claim.status == status)
    if answer_id:
        q = q.where(Claim.answer_id == answer_id)
    return {"claims": db.scalars(q.limit(limit)).all()}


# ---- Trust metrics and report ---------------------------------------------------------------


@router.get("/metrics/trust", response_model=TrustOut)
def trust(days: int = DAYS, db=Depends(get_db)):
    return metrics.trust_metrics(db, days)


@router.get("/report", response_model=ReportOut)
def report(days: int = DAYS, db=Depends(get_db)):
    return metrics.report(db, days)
