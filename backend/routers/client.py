"""Client API, read-only subset (CLIENT_API_CONTRACT.md). Same shapes and code as the dashboard.

v1.1 of the client contract: the key decides the brand. Demo keys are seeded (constants.DEMO_ACCOUNTS);
onboarding adds one per new brand. Approvals and fixes happen only in the dashboard, so a named human
is always accountable.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from db import ApiKey, get_db
from routers.dashboard import DAYS, LIMIT
from routers.governance import SeverityFilter, StatusFilter, list_audit, list_incidents
from schemas import AuditListOut, IncidentsOut, ReportOut, TrustOut, VisibilityOut
from services import metrics

VIEWER_PATHS = {"/api/v1/client/visibility", "/api/v1/client/metrics/trust"}


def require_key(request: Request, x_api_key: str | None = Header(None, alias="X-API-Key"),
                db=Depends(get_db)) -> ApiKey:
    """The caller's key: 401 if missing or unknown, 403 for a viewer outside its two endpoints."""
    key = db.get(ApiKey, x_api_key) if x_api_key else None
    if key is None:
        raise HTTPException(401, "Missing or invalid API key. Send it in the X-API-Key header.")
    if key.role == "viewer" and request.url.path not in VIEWER_PATHS:
        raise HTTPException(403, "The viewer key can read visibility and trust metrics only.")
    return key


router = APIRouter(prefix="/client", tags=["Client API"], dependencies=[Depends(require_key)])


@router.get("/visibility", response_model=VisibilityOut)
def client_visibility(days: int = DAYS, key: ApiKey = Depends(require_key), db=Depends(get_db)):
    return metrics.visibility_summary(db, days, key.brand_id)


@router.get("/metrics/trust", response_model=TrustOut)
def client_trust(days: int = DAYS, key: ApiKey = Depends(require_key), db=Depends(get_db)):
    return metrics.trust_metrics(db, days, key.brand_id)


@router.get("/incidents", response_model=IncidentsOut)
def client_incidents(status: StatusFilter | None = None, severity: SeverityFilter | None = None,
                     limit: int = LIMIT, key: ApiKey = Depends(require_key), db=Depends(get_db)):
    return list_incidents(db, status, severity, limit, key.brand_id)


@router.get("/audit", response_model=AuditListOut)
def client_audit(target_id: str | None = Query(None, alias="targetId"), limit: int = LIMIT,
                 key: ApiKey = Depends(require_key), db=Depends(get_db)):
    return list_audit(db, target_id, limit, key.brand_id)


@router.get("/report", response_model=ReportOut)
def client_report(days: int = DAYS, key: ApiKey = Depends(require_key), db=Depends(get_db)):
    return metrics.report(db, days, key.brand_id)
