"use client";

import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import { getVisibilitySummary } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/** Market Position = the competitors list in GET /visibility/summary (DECISIONS.md #27). */
export default function MarketPosition() {
  const summary = useApi(useCallback(() => getVisibilitySummary(30), []));

  if (summary.loading) return <Loading what="market position" />;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  const s = summary.data!;
  const rows = [
    { brandName: s.brandName, you: true, visibilityRate: s.visibilityRate, averageRank: s.averageRank, shareOfVoice: s.shareOfVoice },
    ...s.competitors.map((c) => ({ ...c, you: false })),
  ].sort((a, b) => b.shareOfVoice - a.shareOfVoice);
  const place = rows.findIndex((r) => r.you) + 1;

  return (
    <div className="stack">
      <section className="card stack">
        <p className="eyebrow">Your position</p>
        <p>
          <span className="big-number">#{place}</span>{" "}
          <span className="muted">
            of {rows.length} brands by share of voice in tracked AI answers, last {s.periodDays} days
          </span>
        </p>
      </section>

      <section className="card stack">
        <h2>Share of voice</h2>
        {s.competitors.length === 0 ? (
          <Empty>No competitors tracked yet.</Empty>
        ) : (
          <>
            <ul className="bar-list">
              {rows.map((r) => (
                <li key={r.brandName}>
                  <div className="bar-label">
                    <span>
                      {r.you ? <strong>{r.brandName} (you)</strong> : r.brandName}
                    </span>
                    <span className="muted small">{formatPercent(r.shareOfVoice)}</span>
                  </div>
                  <div className="bar-track" aria-hidden>
                    <div className={`bar-fill ${r.you ? "bar-fill-you" : ""}`} style={{ width: `${Math.round(r.shareOfVoice * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Visibility</th>
                    <th>Average rank</th>
                    <th>Share of voice</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.brandName}>
                      <td>{r.you ? <strong>{r.brandName} (you)</strong> : r.brandName}</td>
                      <td>{formatPercent(r.visibilityRate)}</td>
                      <td>#{r.averageRank.toFixed(1)}</td>
                      <td>{formatPercent(r.shareOfVoice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="neutral-note">Ranking is neutral: no brand can pay for placement in CIRQO answers.</p>
      </section>
    </div>
  );
}
