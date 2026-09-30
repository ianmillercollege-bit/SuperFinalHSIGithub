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
from db import Answer, Brand, Claim, CommunityRequest, Incident, Product, User, get_db
from services.session import optional_user


def brand_scope(brand_id: str = Query(C.DEFAULT_BRAND_ID, alias="brandId"),
                user: User | None = Depends(optional_user), db=Depends(get_db)) -> str:
    """The brand a dashboard call is about. v1.4: a login token decides it (brandId is then ignored);
    CIRQO Staff belong to no brand and use brandId. Without a token: ?brandId=, default Kestrel.
    404 NOT_FOUND for an unknown brand."""
    if user is not None and user.brand_id:
        return user.brand_id
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
    if head == "creq":  # v1.6 community request: the pledging brand's
        request = db.get(CommunityRequest, target_id)
        return request.brand_id if request else None
    if head == "prod":  # inventory changes belong to the product's brand
        product = db.get(Product, target_id)
        return product.brand_id if product else None
    if head == "brand":
        return target_id if db.get(Brand, target_id) else None
    return None
