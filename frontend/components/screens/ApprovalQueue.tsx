"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import OutstandingView from "@/components/screens/OutstandingView";
import type { IncidentCardData } from "@/components/screens/OutstandingView";
import type { StatData, Tone as KitTone } from "@/components/screens/ui";
import { Toast, useToast } from "@/components/Toast";
import { approveIncident, getIncidents, rejectIncident } from "@/lib/api";
import { canAct, useUserSession } from "@/lib/auth/userSession";
import { describeError } from "@/lib/errors";
import { notifyIncidentsChanged } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { INCIDENT_STATUS_LABELS, RULE_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import { INCIDENT_STATUS_TONES, SEVERITY_TONES } from "@/lib/tones";
import type { Tone } from "@/lib/tones";
import type { Incident } from "@/lib/types";
import { useApi } from "@/lib/useApi";

// The kit's pill tones are ok / bad / warn / neutral / dark; the app's are good / bad / warn / neutral / info.
const KIT_TONE: Record<Tone, KitTone> = { good: "ok", bad: "bad", warn: "warn", neutral: "neutral", info: "dark" };

// Open incidents = pending_approval + escalated (contract v1.1). Each list is capped at 100 by the contract.
async function loadOpen(): Promise<{ pending: Incident[]; escalated: Incident[] }> {
  const [pending, escalated] = await Promise.all([
    getIncidents({ status: "pending_approval", limit: 100 }),
    getIncidents({ status: "escalated", limit: 100 }),
  ]);
  return { pending: pending.incidents, escalated: escalated.incidents };
}

function toCard(incident: Incident): IncidentCardData {
  const escalated = incident.status === "escalated";
  // Safety and legal (escalated) items and critical ones can only be resolved by a person on the claim page.
  const decidable = !escalated && incident.severity !== "critical";
  return {
    id: incident.incidentId,
    severity: { label: SEVERITY_LABELS[incident.severity], tone: KIT_TONE[SEVERITY_TONES[incident.severity]] },
    status: { label: INCIDENT_STATUS_LABELS[incident.status], tone: KIT_TONE[INCIDENT_STATUS_TONES[incident.status]] },
    meta: `Opened ${formatDateTime(incident.createdAt)} · answer ${incident.answerId}`,
    owner: incident.ownerName,
    title: incident.summary,
    aiSaid: incident.aiSaid,
    verifiedFact: incident.verifiedFact,
    rule: RULE_LABELS[incident.ruleId],
    note: escalated
      ? "Safety and legal claims are never fixed automatically. Only the owner can resolve this one: open the claim below."
      : incident.proposedFix ?? undefined,
    decidable,
  };
}

export default function ApprovalQueue() {
  const open = useApi(useCallback(() => loadOpen(), []));
  const session = useUserSession();
  const { toast, show, hide } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const canDecide = canAct(session);
  const approverName = session.user?.role === "owner" ? session.user.name : "";

  async function approve(id: string) {
    if (!approverName) return show("Sign in as an owner to approve.", "error");
    setBusyId(id);
    try {
      // The name must match the incident's owner; the backend answers 403 FORBIDDEN otherwise (decision 32).
      await approveIncident(id, { approverName });
      show(`Approved ${id}.`);
      notifyIncidentsChanged();
      open.reload();
    } catch (error) {
      show(describeError(error), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, name: string, note: string, falseAlarm: boolean) {
    setBusyId(id);
    try {
      await rejectIncident(id, { approverName: name, note, falseAlarm });
      show(`Rejected ${id}.`);
      setRejecting(null);
      notifyIncidentsChanged();
      open.reload();
    } catch (error) {
      show(describeError(error), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (open.loading && open.data === undefined) return <Loading what="outstanding claims" />;
  if (open.error !== undefined) return <ErrorNotice error={open.error} onRetry={open.reload} />;
  const { pending, escalated } = open.data!;
  const incidents = [...pending, ...escalated];

  const stats: StatData[] = [
    { id: "open", label: "Outstanding", value: String(incidents.length), color: incidents.length > 0 ? "var(--cq-bad)" : undefined, note: "Waiting for approval or escalated" },
    { id: "pending", label: "Waiting for approval", value: String(pending.length), note: "High-risk fixes to approve or reject" },
    { id: "escalated", label: "Escalated", value: String(escalated.length), note: "Safety and legal claims" },
  ];

  return (
    <>
      <OutstandingView
        stats={stats}
        incidents={incidents.map(toCard)}
        canDecide={canDecide}
        busyId={busyId}
        onApprove={(id) => void approve(id)}
        onReject={(id) => setRejecting(id)}
      />
      {incidents.length > 0 && (
        <section className="card stack" aria-labelledby="claim-links-title">
          <h2 id="claim-links-title">Claim details</h2>
          <p className="muted small">Open a claim to see its full history, or to resolve an escalated one.</p>
          <ul className="claim-links">
            {incidents.map((i) => (
              <li key={i.incidentId}>
                <Link className="link" href={`/claims/${encodeURIComponent(i.incidentId)}`}>
                  {i.incidentId}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rejecting && (
        <RejectDialog
          id={rejecting}
          initialName={approverName}
          busy={busyId === rejecting}
          onCancel={() => setRejecting(null)}
          onSubmit={(name, note, falseAlarm) => void reject(rejecting, name, note, falseAlarm)}
        />
      )}
      <Toast toast={toast} onClose={hide} />
    </>
  );
}

/** Reject needs a note (contract: 422 if empty) and the approver's name; the view's button only passes the id. */
function RejectDialog({
  id,
  initialName,
  busy,
  onCancel,
  onSubmit,
}: {
  id: string;
  initialName: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (name: string, note: string, falseAlarm: boolean) => void;
}) {
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");
  const [falseAlarm, setFalseAlarm] = useState(false);
  const [problem, setProblem] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => noteRef.current?.focus(), []);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-title"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setProblem("Enter your name.");
          if (!note.trim()) return setProblem("A note is required to reject.");
          setProblem("");
          onSubmit(name.trim(), note.trim(), falseAlarm);
        }}
      >
        <h2 id="reject-title">Reject {id}</h2>
        <label className="field">
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="field">
          Note (required)
          <textarea ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
        <label className="check">
          <input type="checkbox" checked={falseAlarm} onChange={(e) => setFalseAlarm(e.target.checked)} />
          This was a false alarm (the AI was actually right)
        </label>
        {problem && (
          <p className="state-error" role="alert">
            {problem}
          </p>
        )}
        <div className="button-row">
          <button type="submit" className="button" disabled={busy}>
            {busy ? "Rejecting…" : "Reject"}
          </button>
          <button type="button" className="button button-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
