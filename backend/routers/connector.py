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
from db import Answer, Assistant, Brand, Claim, Product, get_db
from ids import next_id
from routers.shopper import reasons_for, to_rankable
from schemas import ConnectorQueryIn, ConnectorQueryOut, ConnectorSearchIn, ConnectorSearchOut
from services.ai_client import source_label
from services.checker import (Catalog, Extracted, audit, brand_mentions, check, extract_claims, human_availability, num,
                              usable_number)
from services.activity import record_activity
from services.categories import infer_category
from services.ranking import TaggedProduct, rank, rank_tagged
from services.search import (brand_verified, matches_must_have, narrowing_hints, product_tags, subcategories_in, use_case_in,
                             wanted_tags)
from timeutil import now_iso

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
    s, name = {k: v for k, v in top.specs.items() if v is not None}, top.name  # only facts on file
    sentences = [
        f"Based on verified data, the {name} (${top.price:.2f}, {human_availability(top.availability)}) fits best."]
    templates = [("batteryHours", "The {name} is rated for {v} hours of battery life."),
                 ("weightLb", "The {name} weighs {v} lb."), ("ramGb", "The {name} has {v} GB of RAM."),
                 ("storageGb", "The {name} comes with {v} GB of storage."),
                 ("screenInches", "The {name} has a {v}-inch display.")]
    sentences += [t.format(name=name, v=num(s[key])) for key, t in templates if key in s]
    if "touch" in must_have and "touchscreen" in s:
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
    # v1.4.1: compare like with like. The question's category (laptops if it names none) decides which
    # products are ranked; if nothing in that category fits, every category is ranked, as before.
    category = infer_category(body.question) or "laptops"
    in_budget = [p for p in products.values() if max_price is None or p.price <= max_price]
    eligible = [to_rankable(p) for p in in_budget if p.category == category] or [to_rankable(p) for p in in_budget]
    ranked = rank(eligible, None, C.USE_CASES.get(use_case), [C.MUST_HAVES[m] for m in must_have])

    brand_rows = {b.brand_id: b for b in db.scalars(select(Brand)).all()}
    brands = {k: b.name for k, b in brand_rows.items()}
    catalog = Catalog(db)
    top = products[ranked[0][0].product_id] if ranked else None
    alt_rows = [(products[p.product_id], score) for p, score in ranked[1:3]]
    # v1.5 section 7d: a pick from a brand that has not opted in is said so, in the text and in the flags.
    top_verified = top is not None and brand_verified(brand_rows.get(top.brand_id))

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
    if top and not top_verified and answer_text:
        answer_text = "Not verified by the brand: " + answer_text

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
    record_activity(db, claims)  # today's trend point for each product's brand

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
            "verifiedAt": top.verified_at, "verified": top_verified}
    alt_flags = [brand_verified(brand_rows.get(p.brand_id)) for p, _ in alt_rows]
    named_flags = ([top_verified] if top else []) + alt_flags
    return {
        "answerId": answer.answer_id, "question": body.question, "assistantId": assistant.assistant_id,
        "recommendation": recommendation,
        "alternatives": [{"productId": p.product_id, "name": p.name, "brandName": brands.get(p.brand_id, ""),
                          "price": p.price, "matchScore": round(score, 2), "verified": flag}
                         for (p, score), flag in zip(alt_rows, alt_flags)],
        "answerText": answer_text, "claims": claims, "rankingNote": C.CONNECTOR_RANKING_NOTE,
        "verifiedAt": at, "source": source_label(),
        "verifiedCount": sum(1 for f in named_flags if f), "unverifiedCount": sum(1 for f in named_flags if not f),
    }


# ---- Connector search: the funnel (v1.4 section 7c) ---------------------------------------------

SEARCH_LIMIT = 5


def option_facts(p: Product, catalog: Catalog, verified: bool = True) -> list[dict]:
    """Short facts for one option, each checked by the checker. Only 'correct' ones are returned. v1.5: for a
    brand that has not opted in, the same facts come back labelled 'unverifiable' (no fact id), never 'correct'."""
    s = {k: v for k, v in (p.specs or {}).items() if v is not None}
    candidates = [(f"${p.price:.2f}", Extracted("", "price", "price", p.product_id, value=str(p.price))),
                  (human_availability(p.availability).capitalize(),
                   Extracted("", "availability", "availability", p.product_id, value=p.availability))]
    for key, text in (("batteryHours", "{v}-hour battery"), ("weightLb", "Weighs {v} lb"),
                      ("screenInches", "{v}-inch screen")):
        if isinstance(s.get(key), (int, float)) and not isinstance(s.get(key), bool):
            candidates.append((text.format(v=num(s[key])),
                               Extracted("", "feature", "spec", p.product_id, value=s[key], attr=key)))
    if p.category == "laptops" and isinstance(s.get("touchscreen"), bool):
        candidates.append(("Touchscreen" if s["touchscreen"] else "No touchscreen",
                           Extracted("", "feature", "spec", p.product_id, value=s["touchscreen"], attr="touchscreen")))
    candidates.append((f"{p.return_policy_days}-day return policy",
                       Extracted("", "policy", "policy", p.product_id, value=p.return_policy_days)))
    facts = []
    for text, claim in candidates:
        result = check(claim, catalog)
        if result.status == "correct":
            facts.append({"text": text, "claimStatus": "correct", "factId": result.fact_id} if verified
                         else {"text": text, "claimStatus": "unverifiable", "factId": result.fact_id})
    return facts


def battery_of(p: Product) -> float | None:
    value = (p.specs or {}).get("batteryHours")
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def ranked_options(products: list[Product], category: str, question: str, use_case: str | None,
                   must_have: list[str]) -> list[tuple[Product, float]]:
    """Neutral ranking. Laptops use exactly /connector/query's ranking; other categories rank on use-case tags
    and battery life. Only shopper-visible facts reach the ranking code."""
    by_id = {p.product_id: p for p in products}
    if category == "laptops":
        legacy = [C.MUST_HAVES[m] for m in must_have if m in C.MUST_HAVES]
        ranked = rank([to_rankable(p) for p in products], None, C.USE_CASES.get(use_case), legacy)
    else:
        tagged = [TaggedProduct(product_id=p.product_id, price=p.price, tags=product_tags(p),
                                battery_hours=battery_of(p)) for p in products]
        ranked = rank_tagged(tagged, wanted_tags(question, use_case, products))
    return [(by_id[r.product_id], score) for r, score in ranked]


@router.post("/search", response_model=ConnectorSearchOut)
def search(body: ConnectorSearchIn, db=Depends(get_db)):
    assistant = db.get(Assistant, body.assistant_id)
    if assistant is None:
        raise HTTPException(404, f"Assistant {body.assistant_id} does not exist.")

    constraints = body.constraints
    category = (constraints.category if constraints else None) or infer_category(body.question) or "laptops"
    max_price = constraints.max_price if constraints else None
    if max_price is None:
        max_price = price_from_question(body.question)
    use_case = (constraints.use_case if constraints else None) or use_case_in(body.question)
    must_have = constraints.must_have if constraints else []

    # Filter: category (and a subcategory the question names, e.g. "graphics card"), budget ("at most") and every must-have. Then the neutral ranking, top 5.
    products = db.scalars(select(Product).where(Product.category == category)).all()
    named = subcategories_in(body.question)
    products = [p for p in products if p.subcategory in named] or products
    fits = [p for p in products if (max_price is None or p.price <= max_price)
            and all(matches_must_have(p, m) for m in must_have)]
    ranked = ranked_options(fits, category, body.question, use_case, must_have)[:SEARCH_LIMIT]
    picked = [p for p, _ in ranked]

    brand_rows = {b.brand_id: b for b in db.scalars(select(Brand)).all()}
    brands = {k: b.name for k, b in brand_rows.items()}
    verified = {p.product_id: brand_verified(brand_rows.get(p.brand_id)) for p in picked}
    catalog = Catalog(db)
    options = [{"productId": p.product_id, "name": p.name, "brandName": brands.get(p.brand_id, ""),
                "price": p.price, "currency": p.currency, "availability": p.availability,
                "matchScore": round(score, 2), "verified": verified[p.product_id],
                "facts": option_facts(p, catalog, verified[p.product_id])} for p, score in ranked]
    hints = narrowing_hints(picked)

    # Recorded like /connector/query: one sentence per option, each checked; only fully correct sentences kept.
    # v1.5: an option from a brand that has not opted in is labelled, and its price is not a verified claim.
    kept, results = [], []
    for i, p in enumerate(picked):
        if not verified[p.product_id]:
            kept.append(f"Not verified by the brand: option {i + 1} is the {p.name} at ${p.price:.2f}.")
            continue
        sentence = f"Verified option {i + 1} is the {p.name} at ${p.price:.2f}."
        checked = [(c, check(c, catalog)) for c in extract_claims(sentence, catalog)]
        if all(r.status == "correct" for _, r in checked):
            kept.append(sentence)
            results.extend(checked)
    answer_text = " ".join(kept) if picked else no_match_sentence(max_price, use_case, must_have)

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
    record_activity(db, claims)

    search_id = "srch_" + answer.answer_id.split("_", 1)[1]
    found = f"returned {len(options)} {category} option(s)" if options else "found no matching product"
    hinted = f"; narrowing hints: {', '.join(h['attribute'] for h in hints)}" if hints else ""
    audit(db, assistant.name, "ai", "connector_search", answer.answer_id,
          f"{assistant.name} searched: \"{body.question}\". CIRQO {found}{hinted}.", at)
    db.commit()

    return {"searchId": search_id, "question": body.question, "assistantId": assistant.assistant_id,
            "category": category, "optionCount": len(options), "options": options, "narrowingHints": hints,
            "verifiedCount": sum(o["verified"] for o in options),
            "unverifiedCount": sum(not o["verified"] for o in options),
            "rankingNote": C.CONNECTOR_RANKING_NOTE, "verifiedAt": at, "source": source_label()}
