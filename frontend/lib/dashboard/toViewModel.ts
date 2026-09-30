// Builds the dashboard view model (lib/dashboard/types.ts): starts from sampleDashboard.ts, then overrides every
// section the contract covers with live data. When showSampleSections is false (lib/config/dashboardSample.ts),
// every section with no live source is dropped.
//
// Live (contract): AI Visibility Score and its weekly change (round(visibilityRate x 100), decision 13),
// the 30-day accuracy and hallucination trend, description accuracy, median time to resolve, claim
// counts, and the latest audit entries. Sample-only: everything marked `sample` in sampleDashboard.ts.
import { showSampleSections } from "../config/dashboardSample";
import { AUDIT_ACTION_LABELS } from "../labels";
import type { AuditEntry, TrustMetrics } from "../types";
import type { DashboardViewModel, ListRow, StatCardData } from "./types";
import { sampleDashboard } from "./sampleDashboard";

export interface LiveDashboardInput {
  firstName: string;
  businessName: string;
  trust: TrustMetrics;
  /** Open = pending_approval + escalated; null while loading or if it failed. */
  claims: { open: number; pending: number; decided: number; decidedCapped: boolean } | null;
  audit: AuditEntry[] | null;
}

const percent = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

/** Averages the daily visibility rate (0 to 1) into weekly scores out of 100, oldest week first. */
function weeklyScores(daily: TrustMetrics["daily"]): number[] {
  const weeks = Math.floor(daily.length / 7);
  const trimmed = daily.slice(daily.length - weeks * 7);
  return Array.from({ length: weeks }, (_, w) => {
    const days = trimmed.slice(w * 7, w * 7 + 7);
    return Math.round((days.reduce((sum, d) => sum + d.visibilityRate, 0) / days.length) * 100);
  });
}

function auditRow(entry: AuditEntry): ListRow {
  return { title: AUDIT_ACTION_LABELS[entry.action], detail: entry.details, href: "/claims/reviewed" };
}

export function toViewModel(input: LiveDashboardInput): DashboardViewModel {
  const { trust, claims, audit } = input;
  const { current, daily } = trust;

  const weekly = weeklyScores(daily);
  const score = Math.round(current.visibilityRate * 100);
  const weekAgo = daily.length > 7 ? daily[daily.length - 8] : undefined;

  const stats: StatCardData[] = [
    { id: "accuracy", label: "Description accuracy", value: percent(current.accuracyRate), note: "Correct claims, last 7 days" },
    { id: "hallucination", label: "Hallucination rate", value: percent(current.hallucinationRate, 1), note: "Invented features, last 7 days" },
    { id: "resolve", label: "Median time to resolve", value: `${current.medianTimeToResolveHours}`, unit: "hours", note: "Closed claims" },
  ];
  if (claims) {
    stats.push(
      { id: "outstanding", label: "Outstanding claims", value: String(claims.open), tone: claims.open > 0 ? "bad" : "good", note: `${claims.pending} waiting for approval`, href: "/claims/outstanding" },
      { id: "reviewed", label: "Claims reviewed", value: `${claims.decided}${claims.decidedCapped ? "+" : ""}`, tone: "good", note: "Approved, rejected, resolved or auto-fixed", href: "/claims/reviewed" },
    );
  }
  if (showSampleSections) stats.push(...sampleDashboard.stats.filter((s) => s.sample));

  const lists = [];
  if (showSampleSections) lists.push(...sampleDashboard.lists.filter((l) => l.sample));
  if (audit) {
    lists.push({ id: "insights", title: "Latest insights", rows: audit.slice(0, 4).map(auditRow), emptyText: "No insights recorded yet." });
  }

  return {
    firstName: input.firstName,
    businessName: input.businessName,
    score: { value: score, changeVsLastWeek: weekAgo ? score - Math.round(weekAgo.visibilityRate * 100) : 0 },
    stats,
    ...(showSampleSections
      ? { opportunities: sampleDashboard.opportunities, opportunitiesAreSample: true, links: { simulator: "/growth-simulator" } }
      : {}),
    weeklyScores: weekly.length > 1 ? weekly : undefined,
    trust: {
      badge: "Seeded pilot data",
      series: [
        { key: "accuracy", label: "Accuracy", title: `${daily.length}-day AI accuracy`, kind: "percent", values: daily.map((d) => d.accuracyRate) },
        { key: "hallucination", label: "Hallucination rate", kind: "percent", values: daily.map((d) => d.hallucinationRate) },
        // The contract has no daily time-to-resolve, so this series is sample-only.
        ...(showSampleSections
          ? sampleDashboard.trust!.series.filter((x) => x.key === "resolve").map((x) => ({ ...x, label: "Time to resolve (sample)" }))
          : []),
      ],
    },
    lists,
  };
}
