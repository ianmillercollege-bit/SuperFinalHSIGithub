// Types for the small-business views and the coach.
//
// These are frontend-only extras on the frontend's own sample data
// (DECISIONS.md #11): no backend endpoints. Reasons use the contract's ruleId
// list (#14).
//
// Rates and shares are 0 to 1 (show with formatPercent). Scores are 0 to 100.
import type { RuleId } from "./types";

/** Where a response came from. "sample" = lib/sample/, "live" = the backend. */
export type DataSourceKind = "sample" | "live";

export interface Sourced {
  source: DataSourceKind;
  /** Set when live mode was asked for but sample data was used instead. */
  fallbackNote?: string;
}

export interface Business {
  name: string;
  category: string;
  region: string;
}

// ---- Why the business was absent from an AI answer (contract ruleIds) ----

export interface RuleReason {
  ruleId: RuleId;
  /** Plain-English explanation shown to the business. */
  text: string;
  /** The opportunity that fixes this reason. */
  opportunityId: string;
}

// ---- Visibility: tracked shopper prompts x assistants ----

export interface TrackedPrompt {
  promptId: string;
  text: string;
}

export interface Assistant {
  assistantId: string;
  name: string;
}

export interface PromptResult {
  promptId: string;
  assistantId: string;
  /** Did the business appear in this answer? */
  appeared: boolean;
  /** Position when it appeared (1 = first), otherwise null. */
  rank: number | null;
  /** Why it did not appear. Empty when appeared is true. */
  ruleIds: RuleId[];
}

export interface AssistantSummary {
  assistantId: string;
  name: string;
  appearances: number;
  checks: number;
  appearanceRate: number;
}

export interface ReasonCount {
  ruleId: RuleId;
  text: string;
  opportunityId: string;
  count: number;
}

export interface VisibilityReport extends Sourced {
  prompts: TrackedPrompt[];
  assistants: Assistant[];
  results: PromptResult[];
  ruleReasons: RuleReason[];
  /** Derived from results. */
  appearances: number;
  checks: number;
  appearanceRate: number;
  byAssistant: AssistantSummary[];
  /** Absence reasons, most common first. */
  reasons: ReasonCount[];
}

// ---- Overview ----

export interface WeeklyScore {
  /** Monday of the week, e.g. "2026-09-28". */
  weekStart: string;
  score: number;
}

export interface Strength {
  title: string;
  detail: string;
}

export interface Weakness {
  ruleId: RuleId;
  title: string;
  /** How many tracked answers this reason affected. */
  count: number;
  opportunityId: string;
}

export interface Overview extends Sourced {
  business: Business;
  /** AI Visibility Score this week, 0 to 100. */
  visibilityScore: number;
  previousScore: number;
  weeklyChange: number;
  /** 8 weeks, oldest first; the last entry is this week. */
  history: WeeklyScore[];
  appearances: number;
  checks: number;
  /** Answers where the business was recommended first. */
  firstPlaceCount: number;
  strengths: Strength[];
  weaknesses: Weakness[];
  /** Score if every opportunity is fully done. */
  potentialScore: number;
  potentialRevenuePerMonth: number;
}

// ---- Market ----

export type MarketKind = "national" | "peer" | "this_business";

export interface MarketEntity {
  id: string;
  name: string;
  kind: MarketKind;
  /** Times named in the tracked AI answers. */
  mentions: number;
}

export interface MarketShares {
  national: number;
  peers: number;
  thisBusiness: number;
}

export interface MarketReport extends Sourced {
  entities: MarketEntity[];
  totalMentions: number;
  /** Share of all mentions in tracked AI answers, 0 to 1, sums to 1. */
  shares: MarketShares;
}

// ---- Opportunities ----

export type Effort = "Low" | "Med" | "High";

export interface Opportunity {
  id: string;
  title: string;
  whyItMatters: string;
  effort: Effort;
  /** Visibility Score points gained when fully done. */
  liftPoints: number;
  steps: string[];
  relatedRuleIds: RuleId[];
}

export interface OpportunitiesReport extends Sourced {
  opportunities: Opportunity[];
  totalLiftPoints: number;
}

// ---- Simulator ----

export interface Assumption {
  label: string;
  value: number;
  /** How to display value: plain number, 0-1 rate, or dollars. */
  unit: "count" | "rate" | "usd";
  explanation: string;
}

export interface SimulatorAssumptions {
  /** Extra revenue per month for each Visibility Score point. */
  revenuePerVisibilityPoint: number;
  /** The numbers behind revenuePerVisibilityPoint, shown to the business. */
  explanation: Assumption[];
}

export interface SimulatorLever {
  opportunityId: string;
  title: string;
  liftPoints: number;
}

export interface SimulatorBaseline extends Sourced {
  visibilityScore: number;
  levers: SimulatorLever[];
  assumptions: SimulatorAssumptions;
}

/** Opportunity id -> how much is done, 0 to 1. */
export type LeverSettings = Record<string, number>;

export interface SimulationResult {
  visibilityBefore: number;
  visibilityAfter: number;
  revenueDeltaPerMonth: number;
}

// ---- Coach ----

export interface CoachMessage {
  role: "user" | "coach";
  text: string;
}

export interface CoachSourceChip {
  label: string;
  value: string;
}

export interface CoachRequest {
  question: string;
  history: CoachMessage[];
}

export interface CoachReply extends Sourced {
  text: string;
  sources: CoachSourceChip[];
  /** Shown with every answer, e.g. that it is a pre-written demo answer (DECISIONS.md #11). */
  disclaimer: string;
}
