"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { getIncidents } from "@/lib/api";
import { RULE_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import { SEVERITY_TONES } from "@/lib/tones";
import type { IncidentStatus } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function ApprovalQueue() {
  return (
    <div className="stack">
      <Queue
        status="pending_approval"
        title="Waiting for approval"
        blurb="High-risk fixes a named person must approve or reject."
        empty="Nothing is waiting for approval."
      />
      <Queue
        status="escalated"
        title="Escalated"
        blurb="Safety and legal claims. Never fixed automatically; only the owner can resolve them."
        empty="No escalated incidents."
      />
    </div>
  );
}

function Queue({ status, title, blurb, empty }: { status: IncidentStatus; title: string; blurb: string; empty: string }) {
  const queue = useApi(useCallback(() => getIncidents({ status }), [status]));
  return (
    <section className="card stack">
      <div>
        <h2>
          {title}
          {queue.data && <span className="count">{queue.data.incidents.length}</span>}
        </h2>
        <p className="muted small">{blurb}</p>
      </div>
      {queue.loading && <Loading what={title.toLowerCase()} />}
      {queue.error !== undefined && <ErrorNotice error={queue.error} onRetry={queue.reload} />}
      {queue.data && queue.data.incidents.length === 0 && <Empty>{empty}</Empty>}
      {queue.data && queue.data.incidents.length > 0 && (
        <ul className="queue">
          {queue.data.incidents.map((incident) => (
            <li key={incident.incidentId} className="queue-item">
              <div className="stack-tight">
                <div className="pill-row">
                  <StatusPill tone={SEVERITY_TONES[incident.severity]}>{SEVERITY_LABELS[incident.severity]}</StatusPill>
                  <span className="muted small">{RULE_LABELS[incident.ruleId]}</span>
                </div>
                <strong>{incident.summary}</strong>
                <span className="small">
                  AI said <em>{incident.aiSaid}</em>, verified fact <em>{incident.verifiedFact}</em>
                </span>
                <span className="muted small">Owner: {incident.ownerName}</span>
              </div>
              <Link className="button" href={`/incidents/${encodeURIComponent(incident.incidentId)}`}>
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
