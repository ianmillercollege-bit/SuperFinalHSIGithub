"""Client API, read-only subset (CLIENT_API_CONTRACT.md). Same shapes and code as the dashboard.

Approvals and fixes happen only in the dashboard, so a named human is always accountable.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from db import get_db
from routers.dashboard import DAYS, LIMIT
from routers.governance import SeverityFilter, StatusFilter, list_audit, list_incidents
from schemas import AuditListOut, IncidentsOut, ReportOut, TrustOut, VisibilityOut
from services import metrics

# DECISIONS.md #6: demo-only keys for seeded data, safe to commit. Unrelated to the AI provider key.
API_KEYS = {"fd_demo_owner_2026": "owner", "fd_demo_viewer_2026": "viewer"}
VIEWER_PATHS = {"/api/v1/client/visibility", "/api/v1/client/metrics/trust"}


def require_key(request: Request, x_api_key: str | None = Header(None, alias="X-API-Key")) -> str:
    role = API_KEYS.get(x_api_key or "")
    if role is None:
        raise HTTPException(401, "Missing or invalid API key. Send it in the X-API-Key header.")
    if role == "viewer" and request.url.path not in VIEWER_PATHS:
        raise HTTPException(403, "The viewer key can read visibility and trust metrics only.")
    return role


router = APIRouter(prefix="/client", tags=["Client API"], dependencies=[Depends(require_key)])


@router.get("/visibility", response_model=VisibilityOut)
def client_visibility(days: int = DAYS, db=Depends(get_db)):
    return metrics.visibility_summary(db, days)


@router.get("/metrics/trust", response_model=TrustOut)
def client_trust(days: int = DAYS, db=Depends(get_db)):
    return metrics.trust_metrics(db, days)


@router.get("/incidents", response_model=IncidentsOut)
def client_incidents(status: StatusFilter | None = None, severity: SeverityFilter | None = None,
                     limit: int = LIMIT, db=Depends(get_db)):
    return list_incidents(db, status, severity, limit)


@router.get("/audit", response_model=AuditListOut)
def client_audit(target_id: str | None = Query(None, alias="targetId"), limit: int = LIMIT, db=Depends(get_db)):
    return list_audit(db, target_id, limit)


@router.get("/report", response_model=ReportOut)
def client_report(days: int = DAYS, db=Depends(get_db)):
    return metrics.report(db, days)
