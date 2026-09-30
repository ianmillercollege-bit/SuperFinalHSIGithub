"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import GrowthSimulatorView from "@/components/screens/GrowthSimulatorView";
import { SampleTag } from "@/components/screens/SampleTag";
import { getVisibilitySummary } from "@/lib/api";
import { scoreFromRate } from "@/lib/dashboard/liveVisibility";
import { getSimulatorBaseline } from "@/lib/dataSource";
import { useApi } from "@/lib/useApi";

/** /growth-simulator: the kit's view on the existing Kestrel sample data (DECISIONS.md #11, #28). */
export default function GrowthSimulator() {
  const baseline = useApi(useCallback(() => getSimulatorBaseline(), []));
  // The starting score is the same live visibility score every other screen shows; only the levers are sample data.
  const live = useApi(useCallback(() => getVisibilitySummary(30), []));
  const initialLever = useSearchParams().get("lever") ?? undefined;
  if (baseline.loading || live.loading) return <Loading what="the simulator" />;
  if (baseline.error !== undefined) return <ErrorNotice error={baseline.error} onRetry={baseline.reload} />;
  if (live.error !== undefined) return <ErrorNotice error={live.error} onRetry={live.reload} />;
  const { levers } = baseline.data!;
  const visibilityScore = scoreFromRate(live.data!.visibilityRate);
  return (
    <GrowthSimulatorView
      baselineScore={visibilityScore}
      levers={levers.map((l) => ({ id: l.opportunityId, name: l.title, liftPoints: l.liftPoints }))}
      initialLever={initialLever}
      headerRight={<SampleTag />}
    />
  );
}
