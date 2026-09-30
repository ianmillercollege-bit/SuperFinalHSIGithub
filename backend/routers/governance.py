"""Incidents, approvals, owners and the append-only audit log (BACKEND_CONTRACT.md section 7).

v1.3 section 7b: the incident list, owners and audit log take an optional ?brandId= (default
brand_001). /incidents/{id} and approve/reject/resolve need none: the incident has its brand.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select

from db import AuditEntry, Incident, Owner, User, get_db
from schemas import ApproveIn, AuditListOut, IncidentOut, IncidentsOut, OwnersOut, RejectIn, ResolveIn
import constants as C
from services.checker import audit
from services.scope import brand_scope
from services.session import VIEWER, optional_user
from timeutil import now_iso

router = APIRouter(tags=["Governance"])

LIMIT = Query(50, ge=1, le=100)
StatusFilter = Literal["auto_fixed", "pending_approval", "approved", "rejected", "escalated", "resolved"]
SeverityFilter = Literal["low", "medium", "high", "critical"]


def list_incidents(db, status: str | None, severity: str | None, limit: int,
                   brand_id: str = C.DEFAULT_BRAND_ID) -> dict:
    q = select(Incident).where(Incident.brand_id == brand_id)         .order_by(Incident.created_at.desc(), Incident.incident_id.desc())
    if status:
        q = q.where(Incident.status == status)
    if severity:
        q = q.where(Incident.severity == severity)
    return {"incidents": db.scalars(q.limit(limit)).all()}


@router.get("/incidents", response_model=IncidentsOut)
def incidents(status: StatusFilter | None = None, severity: SeverityFilter | None = None, limit: int = LIMIT,
              brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return list_incidents(db, status, severity, limit, brand_id)


def get_incident(db, incident_id: str) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(404, f"Incident {incident_id} does not exist.")
    return incident


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def incident_detail(incident_id: str, db=Depends(get_db)):
    return get_incident(db, incident_id)


def same_person(a: str, b: str) -> bool:
    return a.strip().casefold() == b.strip().casefold()


def decide(db, incident_id: str, action: str, name: str | None, note: str | None, false_alarm: bool = False,
           user: User | None = None) -> Incident:
    """Rules for approve / reject / resolve. Order: 404, then 403, then 409 (the contract requires 403 first).

    v1.4: with a login token, a Viewer gets 403 and the name defaults to the signed-in user's name; the
    owner-match rule still applies. Without a token the name is required, as before (422).
    """
    incident = get_incident(db, incident_id)
    if user is not None and user.role == VIEWER:
        raise HTTPException(403, "Viewers can read incidents but cannot approve, reject or resolve them.")
    if not name:
        if user is None:
            field = "resolverName" if action == "resolve" else "approverName"
            raise HTTPException(422, f"body.{field}: Field required (or sign in and send your token).")
        name = user.name
    if action in ("approve", "reject"):
        if incident.severity == "critical":
            raise HTTPException(403, f"Incident {incident_id} is critical (safety/legal). It can only be resolved "
                                     "by its owner, never approved or rejected.")
        if not same_person(name, incident.owner_name):
            raise HTTPException(403, f"Only the owner, {incident.owner_name}, can {action} incident {incident_id}.")
        if incident.status != "pending_approval":
            raise HTTPException(409, f"Incident {incident_id} is {incident.status}, not pending_approval.")
    else:
        if not same_person(name, incident.owner_name):
            raise HTTPException(403, f"Only the owner, {incident.owner_name}, can resolve incident {incident_id}.")
        if incident.status != "escalated":
            raise HTTPException(409, f"Incident {incident_id} is {incident.status}, not escalated.")

    incident.resolved_at = now_iso()
    incident.resolved_by = incident.owner_name
    note_text = f" Note: {note}" if note else ""
    if action == "approve":
        incident.status = "approved"
        audit(db, incident.owner_name, "human", "approved", incident_id,
              f"Approved. Fix applied: {incident.proposed_fix}{note_text}")
    elif action == "reject":
        incident.status = "rejected"
        incident.false_alarm = false_alarm
        audit(db, incident.owner_name, "human", "rejected", incident_id,
              f"Rejected{' as a false alarm' if false_alarm else ''}. No fix applied.{note_text}")
    else:
        incident.status = "resolved"
        audit(db, incident.owner_name, "human", "resolved", incident_id, f"Resolved by a human.{note_text}")
    db.commit()
    return incident


@router.post("/incidents/{incident_id}/approve", response_model=IncidentOut)
def approve(incident_id: str, body: ApproveIn, user: User | None = Depends(optional_user), db=Depends(get_db)):
    return decide(db, incident_id, "approve", body.approver_name, body.note, user=user)


@router.post("/incidents/{incident_id}/reject", response_model=IncidentOut)
def reject(incident_id: str, body: RejectIn, user: User | None = Depends(optional_user), db=Depends(get_db)):
    return decide(db, incident_id, "reject", body.approver_name, body.note, body.false_alarm, user=user)


@router.post("/incidents/{incident_id}/resolve", response_model=IncidentOut)
def resolve(incident_id: str, body: ResolveIn, user: User | None = Depends(optional_user), db=Depends(get_db)):
    return decide(db, incident_id, "resolve", body.resolver_name, body.note, user=user)


@router.get("/owners", response_model=OwnersOut)
def owners(brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    return {"owners": db.scalars(select(Owner).where(Owner.brand_id == brand_id).order_by(Owner.owner_id)).all()}


def list_audit(db, target_id: str | None, limit: int, brand_id: str = C.DEFAULT_BRAND_ID) -> dict:
    # The brand's entries plus brand-neutral ones (e.g. about connector answers every brand sees).
    q = select(AuditEntry).where(or_(AuditEntry.brand_id == brand_id, AuditEntry.brand_id.is_(None)))         .order_by(AuditEntry.timestamp.desc(), AuditEntry.audit_id.desc())
    if target_id:
        q = q.where(AuditEntry.target_id == target_id)
    return {"entries": db.scalars(q.limit(limit)).all()}


@router.get("/audit", response_model=AuditListOut)
def audit_log(target_id: str | None = Query(None, alias="targetId"), limit: int = LIMIT,
              brand_id: str = Depends(brand_scope), db=Depends(get_db)):
    # Append-only: there are deliberately no edit or delete endpoints.
    return list_audit(db, target_id, limit, brand_id)
