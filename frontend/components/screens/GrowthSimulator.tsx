"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import GrowthSimulatorView from "@/components/screens/GrowthSimulatorView";
import { SampleTag } from "@/components/screens/SampleTag";
import { getSimulatorBaseline } from "@/lib/dataSource";
import { useApi } from "@/lib/useApi";

/** /growth-simulator: the kit's view on the existing Kestrel sample data (DECISIONS.md #11, #28). */
export default function GrowthSimulator() {
  const baseline = useApi(useCallback(() => getSimulatorBaseline(), []));
  const initialLever = useSearchParams().get("lever") ?? undefined;
  if (baseline.loading) return <Loading what="sample business data" />;
  if (baseline.error !== undefined) return <ErrorNotice error={baseline.error} onRetry={baseline.reload} />;
  const { visibilityScore, levers } = baseline.data!;
  return (
    <GrowthSimulatorView
      baselineScore={visibilityScore}
      levers={levers.map((l) => ({ id: l.opportunityId, name: l.title, liftPoints: l.liftPoints }))}
      initialLever={initialLever}
      headerRight={<SampleTag />}
    />
  );
}
