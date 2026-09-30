"use client";

import { useCallback } from "react";
import CommunityImpactTile from "@/components/screens/CommunityImpactTile";
import StorefrontRevenue from "@/components/dashboard/StorefrontRevenue";
import DashboardView from "@/components/dashboard/DashboardView";
import { ErrorNotice, Loading } from "@/components/LoadState";
import { getAudit, getIncidents, getTrustMetrics } from "@/lib/api";
import { useBrandSession } from "@/lib/auth/brandSession";
import { useUserSession } from "@/lib/auth/userSession";
import { BUSINESS } from "@/lib/business";
import { toViewModel } from "@/lib/dashboard/toViewModel";
import { useApi } from "@/lib/useApi";

const DAYS = 30;
const DECIDED = ["approved", "rejected", "resolved", "auto_fixed"] as const;

/** The dashboard: live contract data first, plus the sample-only sections when they are switched on. */
export default function DashboardScreen() {
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
  const user = useUserSession().user;
  const brand = useBrandSession();

  if (trust.loading) return <Loading what="the dashboard" />;
  if (trust.error !== undefined) return <ErrorNotice error={trust.error} onRetry={trust.reload} />;

  const vm = toViewModel({
    firstName: user && user.role === "owner" ? user.name.split(/\s+/)[0] : "there",
    businessName: brand?.brandName ?? BUSINESS.name,
    trust: trust.data!,
    claims: claims.data ?? null,
    audit: audit.data?.entries ?? null,
  });
  return (
    <>
      <DashboardView vm={vm} afterOpportunities={vm.storefront ? <StorefrontRevenue data={vm.storefront} /> : undefined} />
      <CommunityImpactTile />
      {claims.error !== undefined && <ErrorNotice error={claims.error} onRetry={claims.reload} />}
      {audit.error !== undefined && <ErrorNotice error={audit.error} onRetry={audit.reload} />}
    </>
  );
}
