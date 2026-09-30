// The app's side of the AI Coach: builds the coach's context from the kit's sample data. Sample mode only
// (DECISIONS.md #11, #28): answers are pre-written, and nothing here calls an AI. The kit's coach files live in
// lib/coach/ and components/coach/ and are used as delivered.
import { BUSINESS } from "./business";
import { contextFromKit } from "./coach/contextFromKit";
import type { CoachContext } from "./coach/types";
import { sampleDashboard } from "./dashboard/sampleDashboard";
import { sampleOpportunities } from "./screens/samples";

export function buildCoachContext(businessName: string): CoachContext {
  return contextFromKit({ businessName, vm: sampleDashboard, opportunities: sampleOpportunities, dataLabel: "sample" });
}

/** One saved chat and plan per signed-in person and company, in this browser only. */
export function coachProfileKey(brandId: string | undefined, userName: string | undefined): string {
  return `${brandId ?? BUSINESS.id}:${userName ?? "guest"}`;
}
