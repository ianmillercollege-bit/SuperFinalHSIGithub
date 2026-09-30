"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import AuditTable from "@/components/AuditTable";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { approveIncident, getAudit, getIncident, rejectIncident, resolveIncident } from "@/lib/api";
import { canAct, useUserSession } from "@/lib/auth/userSession";
import { describeError } from "@/lib/errors";
import { notifyIncidentsChanged } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { HANDLING_LABELS, INCIDENT_STATUS_LABELS, RULE_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import { INCIDENT_STATUS_TONES, SEVERITY_TONES } from "@/lib/tones";
import type { Incident } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function IncidentDetail({ incidentId }: { incidentId: string }) {
  const loaded = useApi(useCallback(() => getIncident(incidentId), [incidentId]));
  const audit = useApi(useCallback(() => getAudit({ targetId: incidentId }), [incidentId]));
  // After an approve/reject/resolve, show the incident the backend returned.
  const [updated, setUpdated] = useState<Incident | null>(null);
  const incident = updated ?? loaded.data;

  if (loaded.loading) return <Loading what="incident" />;
  if (loaded.error !== undefined) return <ErrorNotice error={loaded.error} onRetry={loaded.reload} />;
  if (!incident) return <Empty>Incident not found.</Empty>;

  return (
    <div className="stack">
      <p>
        <Link className="link" href="/claims/outstanding">
          ← Outstanding claims
        </Link>
      </p>
      <section className="card stack">
        <div className="pill-row">
          <StatusPill tone={SEVERITY_TONES[incident.severity]}>{SEVERITY_LABELS[incident.severity]} severity</StatusPill>
          <StatusPill tone={INCIDENT_STATUS_TONES[incident.status]}>{INCIDENT_STATUS_LABELS[incident.status]}</StatusPill>
          <span className="muted small">{incident.incidentId}</span>
        </div>
        <h2>{incident.summary}</h2>
        <div className="compare">
          <div>
            <p className="eyebrow">AI said</p>
            <p className="compare-value compare-bad">{incident.aiSaid}</p>
          </div>
          <div>
            <p className="eyebrow">Verified fact</p>
            <p className="compare-value compare-good">{incident.verifiedFact}</p>
          </div>
        </div>
        <dl className="facts">
          <dt>Rule</dt>
          <dd>{RULE_LABELS[incident.ruleId]}</dd>
          <dt>Handling</dt>
          <dd>{HANDLING_LABELS[incident.handling]}</dd>
          <dt>Proposed fix</dt>
          <dd>{incident.proposedFix ?? "None. Only a person can close this incident."}</dd>
          <dt>Owner</dt>
          <dd>{incident.ownerName}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(incident.createdAt)}</dd>
          <dt>Closed</dt>
          <dd>
            {incident.resolvedAt ? `${formatDateTime(incident.resolvedAt)} by ${incident.resolvedBy}` : "Still open"}
          </dd>
        </dl>
      </section>

      <ActionPanel
        incident={incident}
        onDone={(next) => {
          setUpdated(next);
          audit.reload();
          notifyIncidentsChanged();
        }}
      />

      <section className="card stack">
        <h3>Insights log for this claim</h3>
        {audit.loading && <Loading what="insights log" />}
        {audit.error !== undefined && <ErrorNotice error={audit.error} onRetry={audit.reload} />}
        {audit.data && <AuditTable entries={audit.data.entries} />}
      </section>
    </div>
  );
}

type Action = "approve" | "reject" | "resolve";

function ActionPanel({ incident, onDone }: { incident: Incident; onDone: (incident: Incident) => void }) {
  const session = useUserSession();
  // Decision 32: the name starts as the signed-in owner. It stays editable, so a mismatch shows the
  // backend's 403 (the demo of accountability).
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? (session.user?.role === "owner" ? session.user.name : "");
  const setName = (value: string) => setTyped(value);
  const [note, setNote] = useState("");
  const [falseAlarm, setFalseAlarm] = useState(false);
  const [sending, setSending] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const canApproveOrReject = incident.status === "pending_approval" && incident.severity !== "critical";
  const canResolve = incident.status === "escalated";

  // Viewer or signed out: read-only. A frontend hide, not security (decision 32).
  if ((canApproveOrReject || canResolve) && !canAct(session)) {
    return (
      <section className="card">
        <p className="muted">
          {session.user && !session.user.guest ? "Your role is read-only, so approve, reject and resolve are hidden." : "Sign in as an owner to approve, reject or resolve."} Owner of this
          claim: {incident.ownerName}.
        </p>
      </section>
    );
  }

  if (!canApproveOrReject && !canResolve) {
    return (
      <section className="card">
        <p className="muted">
          No action needed: this incident is {INCIDENT_STATUS_LABELS[incident.status].toLowerCase()}.
          {incident.status === "pending_approval" && incident.severity === "critical" &&
            " Critical incidents can't be approved or rejected."}
        </p>
        {message && <p className={message.kind === "ok" ? "success" : "state-error"}>{message.text}</p>}
      </section>
    );
  }

  async function run(action: Action) {
    // Check required fields first (the backend would reply 422 VALIDATION_ERROR).
    if (!name.trim()) return setMessage({ kind: "error", text: "Enter your name." });
    if ((action === "reject" || action === "resolve") && !note.trim()) {
      return setMessage({ kind: "error", text: "A note is required to reject or resolve." });
    }
    setSending(action);
    setMessage(null);
    try {
      const id = incident.incidentId;
      const result =
        action === "approve"
          ? await approveIncident(id, { approverName: name.trim(), ...(note.trim() ? { note: note.trim() } : {}) })
          : action === "reject"
            ? await rejectIncident(id, { approverName: name.trim(), note: note.trim(), falseAlarm })
            : await resolveIncident(id, { resolverName: name.trim(), note: note.trim() });
      setMessage({ kind: "ok", text: `Done: ${INCIDENT_STATUS_LABELS[result.status].toLowerCase()}.` });
      onDone(result);
    } catch (error) {
      setMessage({ kind: "error", text: describeError(error) });
    } finally {
      setSending(null);
    }
  }

  return (
    <section className="card stack">
      <h3>{canResolve ? "Resolve escalated incident" : "Approve or reject the proposed fix"}</h3>
      <p className="muted small">
        Only the assigned owner, <strong>{incident.ownerName}</strong>, can act on this incident. Every action is
        written to the Insights log.
      </p>
      <label className="field">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className="field">
        Note {canApproveOrReject ? "(required to reject)" : "(required)"}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      {canApproveOrReject && (
        <label className="check">
          <input type="checkbox" checked={falseAlarm} onChange={(e) => setFalseAlarm(e.target.checked)} />
          When rejecting: this was a false alarm (the AI was actually right)
        </label>
      )}
      <div className="button-row">
        {canApproveOrReject && (
          <>
            <button type="button" className="button" disabled={sending !== null} onClick={() => void run("approve")}>
              {sending === "approve" ? "Approving…" : "Approve fix"}
            </button>
            <button
              type="button"
              className="button button-danger"
              disabled={sending !== null}
              onClick={() => void run("reject")}
            >
              {sending === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </>
        )}
        {canResolve && (
          <button type="button" className="button" disabled={sending !== null} onClick={() => void run("resolve")}>
            {sending === "resolve" ? "Resolving…" : "Mark resolved"}
          </button>
        )}
      </div>
      {message && (
        <p className={message.kind === "ok" ? "success" : "state-error"} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
