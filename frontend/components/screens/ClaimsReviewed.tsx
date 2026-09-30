"use client";

import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import ReviewedView from "@/components/screens/ReviewedView";
import type { InsightRow, ReviewedRow } from "@/components/screens/ReviewedView";
import type { StatData, Tone as KitTone } from "@/components/screens/ui";
import { getAudit, getIncidents } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ACTOR_TYPE_LABELS, AUDIT_ACTION_LABELS, INCIDENT_STATUS_LABELS, RULE_LABELS } from "@/lib/labels";
import { INCIDENT_STATUS_TONES } from "@/lib/tones";
import type { Tone } from "@/lib/tones";
import type { AuditEntry, Incident, IncidentStatus } from "@/lib/types";
import { useApi } from "@/lib/useApi";

// Closed incidents (DECISIONS.md #27): approved, rejected, resolved, auto_fixed.
const CLOSED: IncidentStatus[] = ["approved", "rejected", "resolved", "auto_fixed"];
const KIT_TONE: Record<Tone, KitTone> = { good: "ok", bad: "bad", warn: "warn", neutral: "neutral", info: "dark" };

async function load(): Promise<{ closed: Incident[]; audit: AuditEntry[] }> {
  const [lists, audit] = await Promise.all([
    Promise.all(CLOSED.map((status) => getIncidents({ status, limit: 100 }))),
    getAudit({ limit: 20 }),
  ]);
  const closed = lists
    .flatMap((l) => l.incidents)
    .sort((a, b) => Date.parse(b.resolvedAt ?? b.createdAt) - Date.parse(a.resolvedAt ?? a.createdAt));
  return { closed, audit: audit.entries };
}

function toRow(i: Incident): ReviewedRow {
  return {
    id: i.incidentId,
    title: i.summary,
    type: i.ruleId ? RULE_LABELS[i.ruleId] : "No rule",
    outcome: { label: INCIDENT_STATUS_LABELS[i.status], tone: KIT_TONE[INCIDENT_STATUS_TONES[i.status]] },
    detail: `AI said ${i.aiSaid}; verified fact ${i.verifiedFact}.${i.falseAlarm ? " Rejected as a false alarm." : ""}`,
    by: i.resolvedBy ?? "—",
    date: i.resolvedAt ? formatDateTime(i.resolvedAt) : "—",
  };
}

// The view filters insights by the text before " · " in `who`, so it is the actor's name.
const toInsight = (e: AuditEntry): InsightRow => ({
  who: `${e.actor} · ${ACTOR_TYPE_LABELS[e.actorType]}`,
  what: `${AUDIT_ACTION_LABELS[e.action]} (${e.targetId}): ${e.details}`,
});

export default function ClaimsReviewed() {
  const data = useApi(useCallback(() => load(), []));
  if (data.loading) return <Loading what="reviewed claims" />;
  if (data.error !== undefined) return <ErrorNotice error={data.error} onRetry={data.reload} />;
  const { closed, audit } = data.data!;
  const count = (status: IncidentStatus) => closed.filter((i) => i.status === status).length;
  const stats: StatData[] = [
    { id: "total", label: "Reviewed", value: `${closed.length}`, note: "Approved, rejected, resolved or auto-fixed" },
    { id: "auto", label: "Auto-fixed", value: String(count("auto_fixed")), note: "Low-risk fixes applied by the system" },
    { id: "human", label: "Decided by a person", value: String(count("approved") + count("rejected") + count("resolved")), note: "Approved, rejected or resolved" },
  ];
  return <ReviewedView stats={stats} rows={closed.map(toRow)} insights={audit.map(toInsight)} pageSize={8} />;
}
