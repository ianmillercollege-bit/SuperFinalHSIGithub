"""Live activity feeds today's trend point (GET /metrics/trust `daily`, last entry).

Every claim the checker judges (File a claim, connector answers) and every incident it opens is folded
into today's daily-metrics row of the brand whose product it is about, so the 30-day chart moves when
people use the product. Accuracy and hallucination are re-weighted by the number of claims already
counted that day; nothing else in the seeded history changes.
"""

from sqlalchemy import select

import constants as C
from db import Answer, Claim, DailyMetric, Incident, Product
from timeutil import today


def claim_brand(db, claim: Claim) -> str:
    """The brand of the product a claim is about; else its answer's brand; else the default brand."""
    product = db.get(Product, claim.product_id) if claim.product_id else None
    if product:
        return product.brand_id
    answer = db.get(Answer, claim.answer_id)
    return answer.brand_id if answer and answer.brand_id else C.DEFAULT_BRAND_ID


def today_row(db, brand_id: str, day: str) -> DailyMetric | None:
    """The brand's row for today. The seed ends on the startup day, so after UTC midnight the row does not exist
    yet: it is opened from the latest one (same rates, nothing counted). A brand with no trend at all gets None."""
    row = db.get(DailyMetric, (brand_id, day))
    if row is not None:
        return row
    last = db.scalars(select(DailyMetric).where(DailyMetric.brand_id == brand_id)
                      .order_by(DailyMetric.date.desc())).first()
    if last is None or last.date > day:
        return None
    row = DailyMetric(brand_id=brand_id, date=day, accuracy_rate=last.accuracy_rate,
                      hallucination_rate=last.hallucination_rate, claims_checked=0, incidents_opened=0,
                      visibility_rate=last.visibility_rate)
    db.add(row)
    db.flush()
    return row


def record_activity(db, claims: list[Claim] = (), incidents: list[Incident] = ()) -> None:
    by_brand: dict[str, list[Claim]] = {}
    for claim in claims:
        by_brand.setdefault(claim_brand(db, claim), []).append(claim)
    day = today().isoformat()

    for brand_id, brand_claims in by_brand.items():
        row = today_row(db, brand_id, day)
        if row is None:  # a brand with no trend yet (e.g. just onboarded)
            continue
        n, k = row.claims_checked, len(brand_claims)
        judged = [c for c in brand_claims if c.status != "unverifiable"]
        correct = sum(c.status == "correct" for c in judged)
        invented = sum(c.rule_id == "INVENTED_FEATURE" for c in brand_claims)
        if judged:
            row.accuracy_rate = round((row.accuracy_rate * n + correct) / (n + len(judged)), 3)
        row.hallucination_rate = round((row.hallucination_rate * n + invented) / (n + k), 3)
        row.claims_checked = n + k

    for incident in incidents:
        row = today_row(db, incident.brand_id, day)
        if row is not None:
            row.incidents_opened += 1
