"use client";

import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import TrustChart from "@/components/TrustChart";
import AuditTable from "@/components/AuditTable";
import { getAudit, getIncidents, getTrustMetrics } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const DAYS = 30;

export default function TrustDashboard() {
  const trust = useApi(useCallback(() => getTrustMetrics(DAYS), []));
  // Open = pending_approval + escalated (contract v1.1, section 4).
  const counts = useApi(
    useCallback(async () => {
      const [pending, escalated] = await Promise.all([
        getIncidents({ status: "pending_approval", limit: 100 }),
        getIncidents({ status: "escalated", limit: 100 }),
      ]);
      return { pending: pending.incidents.length, open: pending.incidents.length + escalated.incidents.length };
    }, []),
  );
  const latest = useApi(useCallback(() => getAudit({ limit: 5 }), []));

  if (trust.loading) return <Loading what="trust metrics" />;
  if (trust.error !== undefined) return <ErrorNotice error={trust.error} onRetry={trust.reload} />;
  const { current, daily } = trust.data!;

  // DECISIONS.md #13: AI Visibility Score = round(visibilityRate x 100).
  const stats = [
    { label: "Description accuracy", value: formatPercent(current.accuracyRate), note: "Correct claims, last 7 days" },
    { label: "Hallucination rate", value: formatPercent(current.hallucinationRate, 1), note: "Invented features, last 7 days" },
    { label: "AI Visibility Score", value: `${Math.round(current.visibilityRate * 100)}/100`, note: "Share of answers naming the brand" },
    { label: "Median time to resolve", value: `${current.medianTimeToResolveHours} h`, note: "Closed incidents" },
    { label: "False alarm rate", value: formatPercent(current.falseAlarmRate), note: "Rejected as false alarms" },
    { label: "Open claims", value: counts.data ? String(counts.data.open) : "…", note: "Waiting for approval or escalated" },
    { label: "Pending approvals", value: counts.data ? String(counts.data.pending) : "…", note: "High-risk fixes to approve or reject" },
  ];

  return (
    <div className="stack">
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <p className="eyebrow">{s.label}</p>
            <p className="big-number">{s.value}</p>
            <p className="muted small">{s.note}</p>
          </div>
        ))}
      </div>
      <section className="card stack">
        <h2>{DAYS}-day trust trend</h2>
        {daily.length === 0 ? <Empty>No daily metrics yet.</Empty> : <TrustChart daily={daily} />}
        <p className="muted small">Seeded pilot data, not real customer results.</p>
      </section>
      <section className="card stack">
        <h2>Latest insights</h2>
        {latest.loading && <Loading what="latest insights" />}
        {latest.error !== undefined && <ErrorNotice error={latest.error} onRetry={latest.reload} />}
        {latest.data && <AuditTable entries={latest.data.entries} />}
      </section>
    </div>
  );
}
