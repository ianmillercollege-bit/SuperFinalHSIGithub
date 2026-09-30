"use client";

import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import Ring from "@/components/Ring";
import TrustChart from "@/components/TrustChart";
import Link from "next/link";
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
  const score = Math.round(current.visibilityRate * 100);

  return (
    <div className="dash">
      <div className="ring-row">
        <Ring value={current.accuracyRate} label="Description accuracy" note="Correct claims, last 7 days" color="var(--good)" />
        <Ring
          value={current.visibilityRate}
          display={String(score)}
          label="AI Visibility Score"
          note="Out of 100: share of answers naming the brand"
          color="var(--orange)"
        />
        <Ring
          value={current.hallucinationRate}
          digits={1}
          label="Hallucination rate"
          note="Invented features, last 7 days. Lower is better"
          color="var(--bad)"
        />
        <Ring value={current.falseAlarmRate} label="False alarm rate" note="Incidents rejected as false alarms" color="var(--warn)" />
      </div>

      <div className="dash-main">
        <section className="card stack">
          <h2>{DAYS}-day trust trend</h2>
          {daily.length === 0 ? <Empty>No daily metrics yet.</Empty> : <TrustChart daily={daily} />}
          <p className="muted small">Seeded pilot data, not real customer results.</p>
        </section>

        <aside className="dash-side">
          <section className="card stack action-card">
            <h2>Claims that need you</h2>
            <div className="action-numbers">
              <div>
                <p className="big-number">{counts.data ? counts.data.open : "…"}</p>
                <p className="muted small">Open claims</p>
              </div>
              <div>
                <p className="big-number">{counts.data ? counts.data.pending : "…"}</p>
                <p className="muted small">Waiting for approval</p>
              </div>
            </div>
            {counts.error !== undefined && <ErrorNotice error={counts.error} onRetry={counts.reload} />}
            <Link className="button" href="/claims/outstanding">
              Review outstanding claims
            </Link>
          </section>
          <section className="card stack">
            <p className="eyebrow">Median time to resolve</p>
            <p className="big-number">{current.medianTimeToResolveHours} h</p>
            <p className="muted small">From claim opened to closed, closed incidents</p>
          </section>
          {daily.length > 1 && (
            <section className="card stack">
              <h2>Change over {daily.length} days</h2>
              <ul className="change-list">
                {[
                  { label: "Accuracy", key: "accuracyRate" as const, goodWhen: "up" },
                  { label: "Hallucination rate", key: "hallucinationRate" as const, goodWhen: "down" },
                  { label: "Visibility", key: "visibilityRate" as const, goodWhen: "up" },
                ].map((m) => {
                  const from = daily[0][m.key];
                  const to = daily[daily.length - 1][m.key];
                  const points = Math.round((to - from) * 100);
                  const better = m.goodWhen === "up" ? points > 0 : points < 0;
                  return (
                    <li key={m.key}>
                      <span>{m.label}</span>
                      <span>
                        {formatPercent(from)} → {formatPercent(to)}
                      </span>
                      <span className={better ? "change-good" : "change-bad"}>
                        {points > 0 ? "▲" : points < 0 ? "▼" : "•"} {Math.abs(points)} pts {better ? "better" : points === 0 ? "" : "worse"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <section className="card stack">
        <h2>Latest insights</h2>
        {latest.loading && <Loading what="latest insights" />}
        {latest.error !== undefined && <ErrorNotice error={latest.error} onRetry={latest.reload} />}
        {latest.data && <AuditTable entries={latest.data.entries} />}
      </section>
    </div>
  );
}
