"""Connector: what an AI assistant calls (BACKEND_CONTRACT.md v1.1 section 7, "Connector").

CIRQO answers the assistant's shopping question from verified facts, using the same neutral ranking
as the shopper demo. The answer text is composed by plain code and every sentence is checked by
the checker before it is returned. The interaction is stored as an answer and audited so it shows
up in the brand's dashboard.
"""

import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

import constants as C
from db import Answer, Assistant, Brand, Claim, DailyMetric, Product, get_db
from ids import next_id
from routers.shopper import reasons_for, to_rankable
from schemas import ConnectorQueryIn, ConnectorQueryOut
from services.ai_client import source_label
from services.checker import (Catalog, audit, brand_mentions, check, extract_claims, human_availability, num,
                              usable_number)
from services.ranking import rank
from timeutil import now_iso, today

router = APIRouter(prefix="/connector", tags=["Connector"])

MANIFEST = Path(__file__).resolve().parents[1] / "connector" / "manifest.json"
DOLLARS = re.compile(r"\$\s?(\d[\d,]*(?:\.\d{1,2})?)")


@router.get("/manifest")
def manifest() -> dict:
    """How an AI assistant registers CIRQO as a tool. Static file, no auth."""
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def price_from_question(question: str) -> float | None:
    m = DOLLARS.search(question)
    value = float(m.group(1).replace(",", "")) if m else None
    # A number too big to be a price ("$999...9") is ignored rather than used as a budget.
    return value if value and value > 0 and usable_number(value) else None


def compose_sentences(top: Product, brand: str, alternatives: list[Product], must_have: list[str]) -> list[str]:
    """The answer, one verifiable fact per sentence, from the verified catalog only."""
    s, name = top.specs, top.name
    sentences = [
        f"Based on verified data, the {name} (${top.price:.2f}, {human_availability(top.availability)}) fits best.",
        f"The {name} is rated for {num(s['batteryHours'])} hours of battery life.",
        f"The {name} weighs {num(s['weightLb'])} lb.",
        f"The {name} has {num(s['ramGb'])} GB of RAM.",
        f"The {name} comes with {num(s['storageGb'])} GB of storage.",
        f"The {name} has a {num(s['screenInches'])}-inch display.",
    ]
    if "touch" in must_have:
        sentences.append(f"The {name} has a touchscreen." if s["touchscreen"] else f"The {name} has no touchscreen.")
    sentences.append(f"{brand} offers a {top.return_policy_days}-day return policy on the {name}.")
    for alt in alternatives:
        sentences.append(f"Another verified option is the {alt.name} at ${alt.price:.2f}.")
    return sentences


def no_match_sentence(max_price: float | None, use_case: str | None, must_have: list[str]) -> str:
    details = ([f"under ${num(max_price)}"] if max_price else []) + ([f"for {use_case}"] if use_case else []) + \
              ([f"must have: {', '.join(must_have)}"] if must_have else [])
    suffix = f" ({', '.join(details)})" if details else ""
    return (f"No product in the verified catalog matches this request{suffix}. "
            "CIRQO does not guess when verified data has no match.")


def record_in_daily_metrics(db, claims: list[Claim]) -> None:
    """Fold today's checked claims into today's trust-metric row (accuracy and hallucination are re-weighted)."""
    row = db.get(DailyMetric, (C.DEFAULT_BRAND_ID, today().isoformat()))  # brand-neutral: default brand row
    if row is None or not claims:
        return
    n, k = row.claims_checked, len(claims)
    judged = [c for c in claims if c.status != "unverifiable"]
    correct = sum(c.status == "correct" for c in judged)
    invented = sum(c.rule_id == "INVENTED_FEATURE" for c in claims)
    if judged:
        row.accuracy_rate = round((row.accuracy_rate * n + correct) / (n + len(judged)), 3)
    row.hallucination_rate = round((row.hallucination_rate * n + invented) / (n + k), 3)
    row.claims_checked = n + k


@router.post("/query", response_model=ConnectorQueryOut)
def query(body: ConnectorQueryIn, db=Depends(get_db)):
    assistant = db.get(Assistant, body.assistant_id)
    if assistant is None:
        raise HTTPException(404, f"Assistant {body.assistant_id} does not exist.")

    constraints = body.constraints
    max_price = constraints.max_price if constraints else None
    if max_price is None:
        max_price = price_from_question(body.question)
    use_case = constraints.use_case if constraints else None
    must_have = list(dict.fromkeys(constraints.must_have)) if constraints else []

    # Same neutral ranking as the shopper endpoint; maxPrice means "at most".
    products = {p.product_id: p for p in db.scalars(select(Product)).all()}
    eligible = [to_rankable(p) for p in products.values() if max_price is None or p.price <= max_price]
    ranked = rank(eligible, None, C.USE_CASES.get(use_case), [C.MUST_HAVES[m] for m in must_have])

    brands = {b.brand_id: b.name for b in db.scalars(select(Brand)).all()}
    catalog = Catalog(db)
    top = products[ranked[0][0].product_id] if ranked else None
    alt_rows = [(products[p.product_id], score) for p, score in ranked[1:3]]

    if top:
        sentences = compose_sentences(top, brands.get(top.brand_id, ""), [p for p, _ in alt_rows], must_have)
    else:
        sentences = [no_match_sentence(max_price, use_case, must_have)]

    # Every sentence goes through the checker. A sentence is kept only if all of its claims are correct.
    kept, results = [], []
    for sentence in sentences:
        checked = [(c, check(c, catalog)) for c in extract_claims(sentence, catalog)]
        if all(r.status == "correct" for _, r in checked):
            kept.append(sentence)
            results.extend(checked)
    answer_text = " ".join(kept)

    at = now_iso()
    order = brand_mentions(answer_text, catalog)
    client_rank = next((i + 1 for i, b in enumerate(order) if b in catalog.client_brand_ids), None)
    answer = Answer(answer_id=next_id(db, Answer.answer_id, "ans"), query_text=body.question,
                    assistant_id=assistant.assistant_id, answer_text=answer_text,
                    brand_mentioned=client_rank is not None, rank=client_rank,
                    source_ids=[C.CONNECTOR_SOURCE_ID], captured_at=at, source=source_label())
    db.add(answer)
    db.flush()

    claims = []
    for c, r in results:
        claim = Claim(claim_id=next_id(db, Claim.claim_id, "clm"), answer_id=answer.answer_id,
                      product_id=c.product_id, text=c.text, claim_type=c.claim_type,
                      extracted_value=r.extracted_value, verified_value=r.verified_value, status=r.status,
                      rule_id=r.rule_id, fact_id=r.fact_id, reason=r.reason, checked_at=at)
        db.add(claim)
        db.flush()
        claims.append(claim)
    record_in_daily_metrics(db, claims)

    picked = f"recommended the {top.name}" if top else "found no matching product"
    audit(db, assistant.name, "ai", "connector_query", answer.answer_id,
          f"{assistant.name} asked: \"{body.question}\". CIRQO {picked}; {len(claims)} verified claim(s).", at)
    db.commit()

    recommendation = None
    if top:
        recommendation = {
            "productId": top.product_id, "name": top.name, "brandName": brands.get(top.brand_id, ""),
            "price": top.price, "currency": top.currency, "availability": top.availability,
            "matchScore": round(ranked[0][1], 2), "returnPolicyDays": top.return_policy_days,
            "facts": reasons_for(top, max_price, C.USE_CASES.get(use_case),
                                 [C.MUST_HAVES[m] for m in must_have], catalog),
            "verifiedAt": top.verified_at}
    return {
        "answerId": answer.answer_id, "question": body.question, "assistantId": assistant.assistant_id,
        "recommendation": recommendation,
        "alternatives": [{"productId": p.product_id, "name": p.name, "brandName": brands.get(p.brand_id, ""),
                          "price": p.price, "matchScore": round(score, 2)} for p, score in alt_rows],
        "answerText": answer_text, "claims": claims, "rankingNote": C.CONNECTOR_RANKING_NOTE,
        "verifiedAt": at, "source": source_label(),
    }
