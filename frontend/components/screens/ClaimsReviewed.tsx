"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import AuditLog from "@/components/screens/AuditLog";
import { getIncidents } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { INCIDENT_STATUS_LABELS, RULE_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import { INCIDENT_STATUS_TONES, SEVERITY_TONES } from "@/lib/tones";
import type { Incident, IncidentStatus } from "@/lib/types";
import { useApi } from "@/lib/useApi";

// Closed incidents (DECISIONS.md #27): approved, rejected, resolved, auto_fixed.
const CLOSED: IncidentStatus[] = ["approved", "rejected", "resolved", "auto_fixed"];

async function loadClosedIncidents(): Promise<Incident[]> {
  const lists = await Promise.all(CLOSED.map((status) => getIncidents({ status, limit: 100 })));
  return lists
    .flatMap((l) => l.incidents)
    .sort((a, b) => Date.parse(b.resolvedAt ?? b.createdAt) - Date.parse(a.resolvedAt ?? a.createdAt));
}

export default function ClaimsReviewed() {
  const closed = useApi(useCallback(() => loadClosedIncidents(), []));

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <h2>
            Decided claims
            {closed.data && <span className="count">{closed.data.length}</span>}
          </h2>
          <p className="muted small">Approved, rejected, resolved, and automatically fixed incidents, newest first.</p>
        </div>
        {closed.loading && <Loading what="decided claims" />}
        {closed.error !== undefined && <ErrorNotice error={closed.error} onRetry={closed.reload} />}
        {closed.data && closed.data.length === 0 && <Empty>No claims have been decided yet.</Empty>}
        {closed.data && closed.data.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>What happened</th>
                  <th>Rule</th>
                  <th>Decided by</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {closed.data.map((incident) => (
                  <tr key={incident.incidentId}>
                    <td>
                      <div className="stack-tight">
                        <StatusPill tone={INCIDENT_STATUS_TONES[incident.status]}>
                          {INCIDENT_STATUS_LABELS[incident.status]}
                        </StatusPill>
                        <StatusPill tone={SEVERITY_TONES[incident.severity]}>
                          {SEVERITY_LABELS[incident.severity]}
                        </StatusPill>
                      </div>
                    </td>
                    <td>
                      <Link className="link" href={`/claims/${encodeURIComponent(incident.incidentId)}`}>
                        {incident.summary}
                      </Link>
                      {incident.falseAlarm && <span className="muted small"> · false alarm</span>}
                    </td>
                    <td>{incident.ruleId ? RULE_LABELS[incident.ruleId] : "None"}</td>
                    <td>{incident.resolvedBy ?? "—"}</td>
                    <td className="nowrap">{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <div>
          <h2>Insights log</h2>
          <p className="muted small">Every automated, AI and human action, newest first.</p>
        </div>
        <AuditLog />
      </section>
    </div>
  );
}
