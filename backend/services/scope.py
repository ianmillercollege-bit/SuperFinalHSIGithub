"""Brand scoping (BACKEND_CONTRACT.md v1.3 section 7b).

Every brand-facing dashboard endpoint takes an optional ?brandId= (default brand_001, Kestrel), so a
request without it behaves exactly as in v1.2.

What belongs to a brand:
- owners, incidents (the brand that owns the product) and daily metrics: one brand each;
- answers: the brand whose tracked prompt produced them, or no brand (brand-neutral answers from the
  connector and "File a claim"), which every brand sees;
- claims and audit entries: follow the answer or incident they are about.
"""

from fastapi import Depends, HTTPException, Query
from sqlalchemy import or_, select

import constants as C
from db import Answer, Brand, Claim, Incident, get_db


def brand_scope(brand_id: str = Query(C.DEFAULT_BRAND_ID, alias="brandId"), db=Depends(get_db)) -> str:
    """The ?brandId= query parameter. 404 NOT_FOUND for an unknown brand."""
    if db.get(Brand, brand_id) is None:
        raise HTTPException(404, f"Brand {brand_id} does not exist.")
    return brand_id


def answer_visible_to(brand_id: str):
    """SQL condition: answers a brand sees (its own tracked answers plus brand-neutral ones)."""
    return or_(Answer.brand_id == brand_id, Answer.brand_id.is_(None))


def visible_answer_ids(brand_id: str):
    return select(Answer.answer_id).where(answer_visible_to(brand_id))


def brand_of_target(db, target_id: str) -> str | None:
    """The brand an audit entry's target belongs to. None = brand-neutral (seen by every brand)."""
    head = target_id.split("_", 1)[0]
    if head == "inc":
        incident = db.get(Incident, target_id)
        return incident.brand_id if incident else None
    if head == "clm":
        claim = db.get(Claim, target_id)
        answer = db.get(Answer, claim.answer_id) if claim else None
        return answer.brand_id if answer else None
    if head == "ans":
        answer = db.get(Answer, target_id)
        return answer.brand_id if answer else None
    if head == "brand":
        return target_id if db.get(Brand, target_id) else None
    return None
