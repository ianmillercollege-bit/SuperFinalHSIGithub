// The one place pages get dashboard data from.
//
// Sample mode: returns lib/sample/ data after a short delay (so loading states show).
// Live mode: calls the matching function in lib/api.ts. Those are stubs today
// (no endpoint in the contract), so it falls back to sample data and says so.
// To go live, fill in the stub in lib/api.ts. Pages don't change.
import { NotInContractError, getMarketLive, getOpportunitiesLive, getOverviewLive, getSimulatorBaselineLive, getVisibilityLive } from "./api";
import { dataMode } from "./config";
import {
  buildMarketReport,
  buildOpportunitiesReport,
  buildOverview,
  buildSimulatorBaseline,
  buildVisibilityReport,
} from "./sample/derive";
import type {
  MarketReport,
  OpportunitiesReport,
  Overview,
  SimulatorBaseline,
  Sourced,
  VisibilityReport,
} from "./schema";

export const LIVE_NOT_CONNECTED_NOTE = "live endpoint not connected";
const SAMPLE_DELAY_MS = 400;

export function getOverview(): Promise<Overview> {
  return load(buildOverview, getOverviewLive);
}

export function getVisibility(): Promise<VisibilityReport> {
  return load(buildVisibilityReport, getVisibilityLive);
}

export function getMarket(): Promise<MarketReport> {
  return load(buildMarketReport, getMarketLive);
}

export function getOpportunities(): Promise<OpportunitiesReport> {
  return load(buildOpportunitiesReport, getOpportunitiesLive);
}

export function getSimulatorBaseline(): Promise<SimulatorBaseline> {
  return load(buildSimulatorBaseline, getSimulatorBaselineLive);
}

/** Text for the data-source badge, e.g. "Sample data (live endpoint not connected)". */
export function sourceLabel(data: Sourced): string {
  if (data.source === "live") return "Live data";
  return data.fallbackNote ? `Sample data (${data.fallbackNote})` : "Sample data";
}

async function load<T extends Sourced>(
  sample: () => Omit<T, "source" | "fallbackNote">,
  live: () => Promise<T>,
): Promise<T> {
  if (dataMode === "live") {
    try {
      return { ...(await live()), source: "live" };
    } catch (error) {
      if (!(error instanceof NotInContractError)) throw error;
      return { ...sample(), source: "sample", fallbackNote: LIVE_NOT_CONNECTED_NOTE } as T;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, SAMPLE_DELAY_MS));
  return { ...sample(), source: "sample" } as T;
}
