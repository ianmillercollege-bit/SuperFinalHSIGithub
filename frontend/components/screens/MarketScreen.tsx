"use client";

import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import MarketView from "@/components/screens/MarketView";
import { getVisibilitySummary } from "@/lib/api";
import { liveMarketProps } from "@/lib/screens/liveVisibilityMarket";
import { useApi } from "@/lib/useApi";

/** Market Position = the competitors list in GET /visibility/summary (DECISIONS.md #27), shown with the kit's MarketView. */
export default function MarketScreen() {
  const summary = useApi(useCallback(() => getVisibilitySummary(30), []));

  if (summary.loading) return <Loading what="market position" />;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  return <MarketView {...liveMarketProps(summary.data!, summary.data!.brandName)} />;
}
