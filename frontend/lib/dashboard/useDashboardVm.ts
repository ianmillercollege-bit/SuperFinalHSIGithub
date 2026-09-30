"use client";

// The dashboard's numbers, in one place: live contract data first, plus the sample-only sections (toViewModel).
// The dashboard and the AI Coach both read this, so they always show the same figures.
import { useCallback } from "react";
import { getAnswers, getAudit, getIncidents, getTrustMetrics, getVisibilitySummary } from "../api";
import { ANSWERS_LIMIT } from "./liveVisibility";
import { useBrandSession } from "../auth/brandSession";
import { useUserSession } from "../auth/userSession";
import { BUSINESS } from "../business";
import { useProfileIdentity } from "../profile/defaults";
import type { Incident, IncidentStatus } from "../types";
import { useApi } from "../useApi";
import type { InsightItem } from "./insightGroups";
import { toViewModel } from "./toViewModel";

const DAYS = 30;
const DECIDED = ["approved", "rejected", "resolved", "auto_fixed"] as const;

/**
 * Latest insights = the incident records grouped by status (newest first):
 *   accepted  = approved or auto_fixed (the fix was applied);
 *   escalated = escalated (sent to a person, no automatic fix);
 *   needsInfo = none: the contract has no "waiting for information" status, and pending_approval waits for a decision, not for information.
 * rejected and resolved fit no group and are left out. Code and detail are the incident's own id and summary.
 */
function toInsightItems(incidents: Incident[]): InsightItem[] {
  const group = (status: IncidentStatus): InsightItem["status"] | null =>
    status === "approved" || status === "auto_fixed" ? "accepted" : status === "escalated" ? "escalated" : null;
  return incidents
    .flatMap((i) => {
      const status = group(i.status);
      return status ? [{ i, item: { status, code: i.incidentId, detail: i.summary, href: `/claims/${i.incidentId}` } }] : [];
    })
    .sort((a, b) => Date.parse(b.i.resolvedAt ?? b.i.createdAt) - Date.parse(a.i.resolvedAt ?? a.i.createdAt))
    .map((x) => x.item);
}

export function useDashboardVm() {
  const trust = useApi(useCallback(() => getTrustMetrics(DAYS), []));
  const audit = useApi(useCallback(() => getAudit({ limit: 4 }), []));
  const claims = useApi(
    useCallback(async () => {
      const [pending, escalated, ...decided] = await Promise.all([
        getIncidents({ status: "pending_approval", limit: 100 }),
        getIncidents({ status: "escalated", limit: 100 }),
        ...DECIDED.map((status) => getIncidents({ status, limit: 100 })),
      ]);
      const decidedCount = decided.reduce((sum, r) => sum + r.incidents.length, 0);
      return {
        open: pending.incidents.length + escalated.incidents.length,
        pending: pending.incidents.length,
        decided: decidedCount,
        decidedCapped: decided.some((r) => r.incidents.length >= 100),
        insights: toInsightItems([...escalated.incidents, ...decided.flatMap((r) => r.incidents)]),
      };
    }, []),
  );
  const summary = useApi(useCallback(() => getVisibilitySummary(30), []));
  const answers = useApi(useCallback(() => getAnswers({ limit: ANSWERS_LIMIT }), []));
  const user = useUserSession().user;
  const brand = useBrandSession();
  // The greeting and the header name come from the profile saved on this device (or its defaults).
  const identity = useProfileIdentity();

  const vm = trust.data
    ? toViewModel({
        firstName: identity.firstName,
        businessName: user ? identity.businessName : (brand?.brandName ?? BUSINESS.name),
        trust: trust.data,
        claims: claims.data ?? null,
        audit: audit.data?.entries ?? null,
        visibility: summary.data && answers.data ? { summary: summary.data, answers: answers.data.answers } : null,
      })
    : null;
  return { vm, trust, claims, audit, summary, answers };
}

export type DashboardData = ReturnType<typeof useDashboardVm>;
