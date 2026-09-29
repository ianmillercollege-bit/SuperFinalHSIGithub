"""Shopper funnel demo (BACKEND_CONTRACT.md section 7)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

import constants as C
from db import Brand, Product, get_db
from schemas import QuestionsOut, RecommendIn, RecommendOut
from services.ai_client import source_label
from services.checker import Catalog, Extracted, check, num
from services.ranking import RankableProduct, rank

router = APIRouter(prefix="/shopper", tags=["Shopper funnel"])

OPTIONS = {q["questionId"]: {o["optionId"] for o in q["options"]} for q in C.SHOPPER_QUESTIONS["questions"]}


@router.get("/questions", response_model=QuestionsOut)
def questions():
    return C.SHOPPER_QUESTIONS


def to_rankable(p: Product) -> RankableProduct:
    # Only shopper-visible facts cross into ranking. No brand ownership or billing fields.
    s = p.specs
    return RankableProduct(product_id=p.product_id, price=p.price, ram_gb=s["ramGb"], storage_gb=s["storageGb"],
                           screen_inches=s["screenInches"], battery_hours=s["batteryHours"],
                           weight_lb=s["weightLb"], touchscreen=s["touchscreen"])


def reasons_for(p: Product, budget: float | None, use: str | None, liked: list[str], catalog: Catalog) -> list[dict]:
    """Candidate reasons, each checked by the checker. Only 'correct' ones are returned."""
    s = p.specs
    candidates = [(f"${p.price:.2f}, within your under-${num(budget)} budget" if budget else f"${p.price:.2f}",
                   Extracted("", "price", "price", p.product_id, value=str(p.price)))]
    if "s_battery" in liked and s["batteryHours"] >= 10:
        candidates.append((f"{num(s['batteryHours'])}-hour rated battery",
                           Extracted("", "feature", "spec", p.product_id, value=s["batteryHours"], attr="batteryHours")))
    if "s_light" in liked and s["weightLb"] < 3:
        candidates.append((f"Weighs {num(s['weightLb'])} lb",
                           Extracted("", "feature", "spec", p.product_id, value=s["weightLb"], attr="weightLb")))
    if "s_screen" in liked and s["screenInches"] >= 15:
        candidates.append((f"{num(s['screenInches'])}-inch screen",
                           Extracted("", "feature", "spec", p.product_id, value=s["screenInches"], attr="screenInches")))
    if "s_touch" in liked and s["touchscreen"]:
        candidates.append(("Touchscreen", Extracted("", "feature", "spec", p.product_id, value=True, attr="touchscreen")))
    if use in ("u_school", "u_work", "u_media"):
        purpose = {"u_school": "schoolwork", "u_work": "work", "u_media": "streaming and media"}[use]
        candidates.append((f"{num(s['ramGb'])} GB RAM and {num(s['storageGb'])} GB storage for {purpose}",
                           Extracted("", "feature", "spec", p.product_id, value=s["ramGb"], attr="ramGb")))
    reasons = []
    for text, claim in candidates:
        result = check(claim, catalog)
        if result.status == "correct":
            reasons.append({"text": text, "claimStatus": result.status, "factId": result.fact_id})
    return reasons


@router.post("/recommend", response_model=RecommendOut)
def recommend(body: RecommendIn, db=Depends(get_db)):
    chosen = {}
    for a in body.answers:
        if a.question_id not in OPTIONS:
            raise HTTPException(422, f"Unknown questionId '{a.question_id}'.")
        if a.option_id not in OPTIONS[a.question_id]:
            raise HTTPException(422, f"Unknown optionId '{a.option_id}' for question {a.question_id}.")
        chosen[a.question_id] = a.option_id
    liked = []
    for sw in body.swipes:
        if sw.option_id not in OPTIONS["q_swipe"]:
            raise HTTPException(422, f"Unknown optionId '{sw.option_id}' for question q_swipe.")
        if sw.liked and sw.option_id not in liked:
            liked.append(sw.option_id)
    if chosen.get("q_swipe") and chosen["q_swipe"] not in liked:
        liked.append(chosen["q_swipe"])

    budget = C.BUDGET_LIMITS.get(chosen.get("q_budget"))
    use = chosen.get("q_use")
    products = {p.product_id: p for p in db.scalars(select(Product)).all()}
    ranked = rank([to_rankable(p) for p in products.values()], budget, use, liked)

    brands = {b.brand_id: b.name for b in db.scalars(select(Brand)).all()}
    catalog = Catalog(db)
    recommendation, alternatives = None, []
    if ranked:
        top, score = ranked[0]
        p = products[top.product_id]
        recommendation = {"productId": p.product_id, "name": p.name, "brandName": brands.get(p.brand_id, ""),
                          "price": p.price, "currency": p.currency, "availability": p.availability,
                          "matchScore": round(score, 2), "reasons": reasons_for(p, budget, use, liked, catalog),
                          "verifiedAt": p.updated_at}
        for alt, alt_score in ranked[1:3]:
            ap = products[alt.product_id]
            alternatives.append({"productId": ap.product_id, "name": ap.name,
                                 "brandName": brands.get(ap.brand_id, ""), "price": ap.price,
                                 "matchScore": round(alt_score, 2)})
    return {"recommendation": recommendation, "alternatives": alternatives, "rankingNote": C.RANKING_NOTE,
            "source": source_label()}
