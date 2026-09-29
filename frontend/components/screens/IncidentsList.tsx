"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { getIncidents, isOpenIncident } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { INCIDENT_STATUS_LABELS, RULE_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import { INCIDENT_STATUS_TONES, SEVERITY_TONES } from "@/lib/tones";
import type { IncidentStatus, Severity } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function IncidentsList() {
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const incidents = useApi(
    useCallback(
      () => getIncidents({ status: status || undefined, severity: severity || undefined }),
      [status, severity],
    ),
  );

  return (
    <div className="stack">
      <div className="filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}>
            <option value="">All</option>
            {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}>
            <option value="">All</option>
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {incidents.loading && <Loading what="incidents" />}
      {incidents.error !== undefined && <ErrorNotice error={incidents.error} onRetry={incidents.reload} />}
      {incidents.data && incidents.data.incidents.length === 0 && <Empty>No incidents match these filters.</Empty>}
      {incidents.data && incidents.data.incidents.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>What happened</th>
                <th>Rule</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {incidents.data.incidents.map((incident) => (
                <tr key={incident.incidentId}>
                  <td>
                    <StatusPill tone={SEVERITY_TONES[incident.severity]}>{SEVERITY_LABELS[incident.severity]}</StatusPill>
                  </td>
                  <td>
                    <Link className="link" href={`/incidents/${encodeURIComponent(incident.incidentId)}`}>
                      {incident.summary}
                    </Link>
                  </td>
                  <td>{RULE_LABELS[incident.ruleId]}</td>
                  <td>{incident.ownerName}</td>
                  <td>
                    <StatusPill tone={INCIDENT_STATUS_TONES[incident.status]}>
                      {INCIDENT_STATUS_LABELS[incident.status]}
                    </StatusPill>
                    {isOpenIncident(incident) && <span className="muted small"> · open</span>}
                  </td>
                  <td className="nowrap">{formatDateTime(incident.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
