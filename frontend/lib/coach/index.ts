// Pages use this file only. NEXT_PUBLIC_COACH_MODE picks the coach:
// "sample" (default) = rule-based answers from sample data, "live" = backend.
import { coachMode } from "../config";
import { getMarket, getOpportunities, getOverview, getSimulatorBaseline, getVisibility } from "../dataSource";
import type { CoachMessage, CoachReply } from "../schema";
import { apiCoach } from "./apiCoach";
import { sampleCoach } from "./sampleCoach";
import type { CoachContext, CoachProvider } from "./types";

export { SUGGESTED_QUESTIONS } from "./sampleCoach";
export type { CoachContext, CoachProvider } from "./types";

export const coach: CoachProvider = coachMode === "live" ? apiCoach : sampleCoach;

/** Loads the dashboard data the coach answers from. */
export async function loadCoachContext(): Promise<CoachContext> {
  const [overview, visibility, market, opportunities, baseline] = await Promise.all([
    getOverview(),
    getVisibility(),
    getMarket(),
    getOpportunities(),
    getSimulatorBaseline(),
  ]);
  return { overview, visibility, market, opportunities, baseline };
}

export function askCoach(
  question: string,
  history: CoachMessage[],
  context: CoachContext,
): Promise<CoachReply> {
  return coach.ask(question, history, context);
}
