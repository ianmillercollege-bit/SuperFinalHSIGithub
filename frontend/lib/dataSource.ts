// The one place pages get the frontend-only extras from (overview, visibility
// report, market, opportunities, simulator baseline).
//
// These have no backend endpoints (DECISIONS.md #11): they always return the
// frontend's own sample data from lib/sample/, after a short delay so loading
// states show. To plug in real data later, change only this file.
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

const SAMPLE_DELAY_MS = 400;

export function getOverview(): Promise<Overview> {
  return load(buildOverview);
}

export function getVisibility(): Promise<VisibilityReport> {
  return load(buildVisibilityReport);
}

export function getMarket(): Promise<MarketReport> {
  return load(buildMarketReport);
}

export function getOpportunities(): Promise<OpportunitiesReport> {
  return load(buildOpportunitiesReport);
}

export function getSimulatorBaseline(): Promise<SimulatorBaseline> {
  return load(buildSimulatorBaseline);
}

async function load<T extends Sourced>(sample: () => Omit<T, "source" | "fallbackNote">): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, SAMPLE_DELAY_MS));
  return { ...sample(), source: "sample" } as T;
}
