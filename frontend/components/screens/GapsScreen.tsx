"use client";

import { useCallback, useEffect, useState } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import OpportunityGapsView, { type OpportunityDetail } from "@/components/screens/OpportunityGapsView";
import { useDashboardVm } from "@/lib/dashboard/useDashboardVm";
import { PROFILE_KEY } from "@/lib/profile/defaults";
import { sampleOpportunities } from "@/lib/screens/samples";

const PLANNED_KEY = `cirqo:v1:${PROFILE_KEY}:planned-gaps`;

/** Saved on this device only. Anything that is not an array of known ids is ignored. */
function readPlanned(known: string[]): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PLANNED_KEY) ?? "[]");
    return Array.isArray(raw) ? known.filter((id) => raw.includes(id)) : [];
  } catch {
    return [];
  }
}

/**
 * Opportunity Gaps: the same rows as the dashboard's "Opportunity gaps" card (title, effort, points, $/month),
 * with the explanation and first step from the sample details, matched by title. The "Sample data" bar in the
 * app layout already labels this page, so no second badge is drawn here.
 */
export default function GapsScreen() {
  const { vm, trust } = useDashboardVm();
  const [planned, setPlanned] = useState<string[]>([]);

  const items: OpportunityDetail[] = (vm?.opportunities ?? []).flatMap((row) => {
    const detail = sampleOpportunities.find((s) => s.title === row.title);
    return detail ? [{ ...detail, ...row, why: detail.why, step: detail.step }] : [];
  });
  const knownKey = items.map((i) => i.id).join(",");

  useEffect(() => {
    setPlanned(readPlanned(knownKey ? knownKey.split(",") : []));
  }, [knownKey]);

  const toggle = useCallback((id: string) => {
    setPlanned((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      try {
        window.localStorage.setItem(PLANNED_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: the choice lasts until the page is closed */
      }
      return next;
    });
  }, []);

  if (trust.loading) return <Loading what="opportunity gaps" />;
  if (trust.error !== undefined) return <ErrorNotice error={trust.error} onRetry={trust.reload} />;
  if (items.length === 0) return <Empty>No opportunity gaps to show yet.</Empty>;

  return (
    <OpportunityGapsView items={items} planned={planned} onTogglePlanned={toggle} simulatorHref="/growth-simulator" />
  );
}
