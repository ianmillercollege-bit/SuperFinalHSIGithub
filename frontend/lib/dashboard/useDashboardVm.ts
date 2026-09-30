"use client";

// The dashboard's numbers, in one place: live contract data first, plus the sample-only sections (toViewModel).
// The dashboard and the AI Coach both read this, so they always show the same figures.
import { useCallback } from "react";
import { getAnswers, getAudit, getIncidents, getTrustMetrics, getVisibilitySummary } from "../api";
import { ANSWERS_LIMIT } from "./liveVisibility";
import { useBrandSession } from "../auth/brandSession";
import { useUserSession } from "../auth/userSession";
import { BUSINESS } from "../business";
import { useApi } from "../useApi";
import { toViewModel } from "./toViewModel";

const DAYS = 30;
const DECIDED = ["approved", "rejected", "resolved", "auto_fixed"] as const;

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
      };
    }, []),
  );
  const summary = useApi(useCallback(() => getVisibilitySummary(30), []));
  const answers = useApi(useCallback(() => getAnswers({ limit: ANSWERS_LIMIT }), []));
  const user = useUserSession().user;
  const brand = useBrandSession();

  const vm = trust.data
    ? toViewModel({
        firstName: user && user.role === "owner" ? user.name.split(/\s+/)[0] : "there",
        businessName: brand?.brandName ?? BUSINESS.name,
        trust: trust.data,
        claims: claims.data ?? null,
        audit: audit.data?.entries ?? null,
        visibility: summary.data && answers.data ? { summary: summary.data, answers: answers.data.answers } : null,
      })
    : null;
  return { vm, trust, claims, audit, summary, answers };
}

export type DashboardData = ReturnType<typeof useDashboardVm>;
