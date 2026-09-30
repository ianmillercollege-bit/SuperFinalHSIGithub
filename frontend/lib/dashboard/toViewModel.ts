// Builds the dashboard view model (lib/dashboard/types.ts): starts from sampleDashboard.ts, then overrides every
// section the contract covers with live data. When showSampleSections is false (lib/config/dashboardSample.ts),
// every section with no live source is dropped.
//
// Live (contract): AI Visibility Score and its weekly change (round(visibilityRate x 100), decision 13),
// the 30-day accuracy and hallucination trend, description accuracy, median time to resolve, claim
// counts, and the latest audit entries. Sample-only: everything marked `sample` in sampleDashboard.ts.
import { showSampleSections } from "../config/dashboardSample";
import { DEFAULT_ASSUMPTIONS, simulate } from "../screens/simulate";
import type { Answer, AuditEntry, TrustMetrics, VisibilitySummary } from "../types";
import { liveVisibility, scoreFromRate } from "./liveVisibility";
import type { DashboardViewModel, ListRow, StatCardData } from "./types";
import { buildInsightGroups, type InsightItem } from "./insightGroups";
import { sampleDashboard } from "./sampleDashboard";

export interface LiveDashboardInput {
  firstName: string;
  businessName: string;
  trust: TrustMetrics;
  /** Open = pending_approval + escalated; null while loading or if it failed. */
  claims: { open: number; pending: number; decided: number; decidedCapped: boolean; insights: InsightItem[] } | null;
  audit: AuditEntry[] | null;
  /** The recorded-answers visibility (GET /visibility/summary and /answers). When present it is the one visibility number on every screen. */
  visibility?: { summary: VisibilitySummary; answers: Answer[] } | null;
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

export function toViewModel(input: LiveDashboardInput): DashboardViewModel {
  const { trust, claims } = input;
  const { current, daily } = trust;

  const weekly = weeklyScores(daily);
  const live = input.visibility ? liveVisibility(input.visibility.summary, input.visibility.answers) : null;
  // One visibility number for every screen: the recorded answers' 30-day rate. The seeded trend (metrics/trust) only
  // supplies the week-over-week change and the trend chart, and the chart says so.
  const score = live ? live.score : scoreFromRate(current.visibilityRate);
  const weekAgo = daily.length > 7 ? daily[daily.length - 8] : undefined;
  const change = weekAgo ? Math.round(current.visibilityRate * 100) - Math.round(weekAgo.visibilityRate * 100) : 0;

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
  if (showSampleSections) {
    // Recommendation frequency and the revenue estimate follow the live score instead of the sample's fixed 58% and $18,060.
    const perPoint = simulate(score, [], {}, DEFAULT_ASSUMPTIONS).perPoint;
    for (const sample of sampleDashboard.stats.filter((x) => x.sample)) {
      if (sample.id === "frequency" && live) {
        stats.push({ id: "frequency", label: "Recommendation frequency", value: `${Math.round(live.rate * 100)}%`, note: `${live.recommended} of ${live.tested} recorded answers, last ${live.periodDays} days` });
      } else if (sample.id === "revenue") {
        stats.push({ ...sample, value: `$${Math.round(score * perPoint).toLocaleString("en-US")}` });
      } else {
        stats.push(sample);
      }
    }
  }

  const lists = [];
  if (showSampleSections) lists.push(...sampleDashboard.lists.filter((l) => l.sample));
  // Grouped from the incident records (see toInsightItems). Left out while they load, so no sample rows show in the meantime.
  if (claims) {
    lists.push({ id: "insights", title: "Latest insights", rows: [], groups: buildInsightGroups(claims.insights, 1), emptyText: "No insights recorded yet." });
  }

  return {
    firstName: input.firstName,
    businessName: input.businessName,
    score: { value: score, changeVsLastWeek: change },
    stats,
    ...(showSampleSections && sampleDashboard.storefront ? { storefront: sampleDashboard.storefront } : {}),
    ...(showSampleSections
      ? { opportunities: sampleDashboard.opportunities, opportunitiesAreSample: true, links: { opportunities: "/gaps", simulator: "/growth-simulator" } }
      : {}),
    weeklyScores: weekly.length > 1 ? weekly : undefined,
    weeklyBadge: "Seeded pilot data",
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
