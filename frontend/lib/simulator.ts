// What-if simulator. Pure function: same inputs always give the same answer.
import type {
  LeverSettings,
  SimulationResult,
  SimulatorAssumptions,
  SimulatorBaseline,
  SimulatorLever,
} from "./schema";

/**
 * levers: opportunity id -> how much is done (0 to 1). Missing ids count as 0.
 * Visibility gain = sum of (liftPoints x how much is done), capped at 100.
 */
export function simulate(
  levers: LeverSettings,
  baseline: Pick<SimulatorBaseline, "visibilityScore" | "levers">,
  assumptions: SimulatorAssumptions,
): SimulationResult {
  const gain = baseline.levers.reduce(
    (sum, lever) => sum + lever.liftPoints * clamp01(levers[lever.opportunityId] ?? 0),
    0,
  );
  const visibilityBefore = baseline.visibilityScore;
  const visibilityAfter = Math.min(100, round1(visibilityBefore + gain));
  const pointsGained = visibilityAfter - visibilityBefore;
  return {
    visibilityBefore,
    visibilityAfter,
    revenueDeltaPerMonth: Math.round(pointsGained * assumptions.revenuePerVisibilityPoint),
  };
}

/** Every lever at 100%. */
export function allLeversOn(levers: SimulatorLever[]): LeverSettings {
  return Object.fromEntries(levers.map((lever) => [lever.opportunityId, 1]));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
