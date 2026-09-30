"""Community program endpoints (BACKEND_CONTRACT.md v1.6 section 7e). The rules live in services/community.py.

- GET  /community/catalog                        Community Partner or CIRQO Staff token
- POST /community/requests                       Community Partner token
- GET  /community/requests                       partner: own; brand: its products; staff: all
- POST /community/requests/{id}/approve|reject   the product brand's Brand Data Owner
- GET  /community/impact                         brand token or ?brandId=
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import Field, field_validator

import constants as C
from db import User, get_db
from schemas import CamelModel, CommunityPledge, Reason, _not_blank
from services import community
from services.scope import brand_scope
from services.session import optional_user

router = APIRouter(prefix="/community", tags=["Community program"])

LIMIT = Query(50, ge=1, le=100)
Category = Literal["laptops", "headphones", "phones_tablets", "computer_hardware"]
RequestStatus = Literal["pending_approval", "approved", "rejected"]


class CatalogItem(CamelModel):
    product_id: str
    name: str
    brand_id: str
    brand_name: str
    category: Category
    condition: Literal["new", "refurbished", "surplus"]
    price: float
    verified: bool
    community_pledge: CommunityPledge
    facts: list[Reason]


class CatalogOut(CamelModel):
    items: list[CatalogItem]


class RequestIn(CamelModel):
    product_id: str = Field(max_length=100)
    units: int = Field(ge=1, le=100_000)
    # What the units are for. Never who receives them: CIRQO stores no recipient data.
    purpose: str = Field(max_length=500)

    @field_validator("purpose")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class DecideIn(CamelModel):
    note: str | None = Field(None, max_length=C.MAX_NOTE_CHARS)


class Partner(CamelModel):
    org_id: str
    org_name: str


class RequestOut(CamelModel):
    request_id: str
    status: RequestStatus
    product_id: str
    product_name: str | None
    brand_id: str
    partner: Partner
    units: int
    purpose: str
    created_at: str
    decided_at: str | None
    decided_by: str | None
    note: str | None


class RequestsOut(CamelModel):
    requests: list[RequestOut]


class CategoryImpact(CamelModel):
    category: str
    units_pledged: int
    units_placed: int


class ImpactOut(CamelModel):
    brand_id: str
    units_pledged: int
    units_placed: int
    partners_served: int
    requests_pending: int
    by_category: list[CategoryImpact]


@router.get("/catalog", response_model=CatalogOut)
def catalog(category: Category | None = None, brand_id: str | None = Query(None, alias="brandId"),
            condition: Literal["new", "refurbished", "surplus"] | None = None, limit: int = LIMIT,
            user: User | None = Depends(optional_user), db=Depends(get_db)):
    community.require_partner_or_staff(user)
    return {"items": community.catalog_items(db, category, brand_id, condition, limit)}


@router.post("/requests", response_model=RequestOut, status_code=201)
def create_request(body: RequestIn, user: User | None = Depends(optional_user), db=Depends(get_db)):
    partner = community.require_partner(user)
    r = community.create_request(db, partner, body.product_id, body.units, body.purpose)
    return community.request_out(db, r)


@router.get("/requests", response_model=RequestsOut)
def list_requests(status: RequestStatus | None = None, limit: int = LIMIT,
                  user: User | None = Depends(optional_user), db=Depends(get_db)):
    return {"requests": [community.request_out(db, r) for r in community.list_requests(db, user, status, limit)]}


@router.post("/requests/{request_id}/approve", response_model=RequestOut)
def approve(request_id: str, body: DecideIn | None = None, user: User | None = Depends(optional_user),
            db=Depends(get_db)):
    r = community.decide(db, user, request_id, True, body.note if body else None)
    return community.request_out(db, r)


@router.post("/requests/{request_id}/reject", response_model=RequestOut)
def reject(request_id: str, body: DecideIn | None = None, user: User | None = Depends(optional_user),
           db=Depends(get_db)):
    r = community.decide(db, user, request_id, False, body.note if body else None)
    return community.request_out(db, r)


@router.get("/impact", response_model=ImpactOut)
def impact(brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return community.impact(db, brand_id)
