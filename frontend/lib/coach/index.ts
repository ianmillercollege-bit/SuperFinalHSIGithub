// Pages use this file only. The coach gives pre-written demo answers built
// from sample data (DECISIONS.md #11). To plug in a real chatbot later, write
// another CoachProvider and switch `coach` below. Pages don't change.
import { getMarket, getOpportunities, getOverview, getSimulatorBaseline, getVisibility } from "../dataSource";
import type { CoachMessage, CoachReply } from "../schema";
import { sampleCoach } from "./sampleCoach";
import type { CoachContext, CoachProvider } from "./types";

export { COACH_DEMO_DISCLAIMER, SUGGESTED_QUESTIONS } from "./sampleCoach";
export type { CoachContext, CoachProvider } from "./types";

export const coach: CoachProvider = sampleCoach;

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
