"use client";

import DashboardPlan from "@/components/coach/DashboardPlan";
import StorefrontRevenue from "@/components/dashboard/StorefrontRevenue";
import DashboardView from "@/components/dashboard/DashboardView";
import { ErrorNotice, Loading } from "@/components/LoadState";
import { useCoachContextFrom } from "@/lib/coach/session";
import { useDashboardVm } from "@/lib/dashboard/useDashboardVm";

/** The dashboard: live contract data first, plus the sample-only sections when they are switched on. */
export default function DashboardScreen() {
  const dash = useDashboardVm();
  const coach = useCoachContextFrom(dash);
  const { vm, trust, claims, audit } = dash;

  if (trust.loading) return <Loading what="the dashboard" />;
  if (trust.error !== undefined) return <ErrorNotice error={trust.error} onRetry={trust.reload} />;

  return (
    <>
      <DashboardView vm={vm!} afterCharts={<DashboardPlan session={coach} />} afterOpportunities={vm!.storefront ? <StorefrontRevenue data={vm!.storefront} /> : undefined} />
      {claims.error !== undefined && <ErrorNotice error={claims.error} onRetry={claims.reload} />}
      {audit.error !== undefined && <ErrorNotice error={audit.error} onRetry={audit.reload} />}
    </>
  );
}
