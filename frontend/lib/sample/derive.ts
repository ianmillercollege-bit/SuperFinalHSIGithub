// Builds each view from the raw sample lists. Every summary number (score,
// counts, shares, revenue) is calculated here, never typed in twice.
import { simulatorAssumptions } from "../config/simulatorAssumptions";
import type {
  AssistantSummary,
  MarketReport,
  OpportunitiesReport,
  Opportunity,
  Overview,
  PromptResult,
  ReasonCount,
  SimulatorBaseline,
  Strength,
  VisibilityReport,
  WeeklyScore,
} from "../schema";
import { allLeversOn, simulate } from "../simulator";
import { otherBusinesses } from "./market";
import { opportunityInputs } from "./opportunities";
import { pastWeeklyScores, thisWeekStart } from "./overview";
import { ruleReasons } from "./ruleReasons";
import { sampleBusiness } from "./sampleBusiness";
import { assistants, prompts, resultGrid } from "./visibility";

/** Views without the `source` field; lib/dataSource.ts adds it. */
type Unsourced<T> = Omit<T, "source" | "fallbackNote">;

// ---- Shared calculations ----

/**
 * AI Visibility Score (0 to 100) = round(visibilityRate x 100) (DECISIONS.md #13).
 * visibilityRate = share of tracked answers mentioning the business.
 */
export function visibilityScoreFromRate(visibilityRate: number): number {
  return Math.round(visibilityRate * 100);
}

export function expandResults(): PromptResult[] {
  return prompts.flatMap(({ promptId }) =>
    assistants.map(({ assistantId }, i) => {
      const cell = resultGrid[promptId]?.[i];
      if (cell === undefined) {
        throw new Error(`Missing result for ${promptId} x ${assistantId} in lib/sample/visibility.ts`);
      }
      return typeof cell === "number"
        ? { promptId, assistantId, appeared: true, rank: cell, ruleIds: [] }
        : { promptId, assistantId, appeared: false, rank: null, ruleIds: cell };
    }),
  );
}

function assistantSummaries(results: PromptResult[]): AssistantSummary[] {
  return assistants.map(({ assistantId, name }) => {
    const mine = results.filter((r) => r.assistantId === assistantId);
    const appearances = mine.filter((r) => r.appeared).length;
    return { assistantId, name, appearances, checks: mine.length, appearanceRate: appearances / mine.length };
  });
}

function reasonCountsFrom(results: PromptResult[]): ReasonCount[] {
  return ruleReasons
    .map(({ ruleId, text, opportunityId }) => ({
      ruleId,
      text,
      opportunityId,
      count: results.filter((r) => r.ruleIds.includes(ruleId)).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

function opportunitiesWithReasons(): Opportunity[] {
  return opportunityInputs.map((opportunity) => ({
    ...opportunity,
    relatedRuleIds: ruleReasons
      .filter((reason) => reason.opportunityId === opportunity.id)
      .map((reason) => reason.ruleId),
  }));
}

// ---- Views ----

export function buildVisibilityReport(): Unsourced<VisibilityReport> {
  const results = expandResults();
  const appearances = results.filter((r) => r.appeared).length;
  return {
    prompts,
    assistants,
    results,
    ruleReasons,
    appearances,
    checks: results.length,
    appearanceRate: appearances / results.length,
    byAssistant: assistantSummaries(results),
    reasons: reasonCountsFrom(results),
  };
}

export function buildOpportunitiesReport(): Unsourced<OpportunitiesReport> {
  const opportunities = opportunitiesWithReasons();
  return {
    opportunities,
    totalLiftPoints: opportunities.reduce((sum, o) => sum + o.liftPoints, 0),
  };
}

export function buildSimulatorBaseline(): Unsourced<SimulatorBaseline> {
  const { appearanceRate } = buildVisibilityReport();
  return {
    visibilityScore: visibilityScoreFromRate(appearanceRate),
    levers: opportunityInputs.map(({ id, title, liftPoints }) => ({
      opportunityId: id,
      title,
      liftPoints,
    })),
    assumptions: simulatorAssumptions,
  };
}

export function buildMarketReport(): Unsourced<MarketReport> {
  const { appearances } = buildVisibilityReport();
  const entities = [
    ...otherBusinesses,
    { id: "this_business", name: sampleBusiness.name, kind: "this_business" as const, mentions: appearances },
  ];
  const totalMentions = entities.reduce((sum, e) => sum + e.mentions, 0);
  const shareOf = (kind: string) =>
    entities.filter((e) => e.kind === kind).reduce((sum, e) => sum + e.mentions, 0) / totalMentions;
  return {
    entities,
    totalMentions,
    shares: { national: shareOf("national"), peers: shareOf("peer"), thisBusiness: shareOf("this_business") },
  };
}

export function buildOverview(): Unsourced<Overview> {
  const visibility = buildVisibilityReport();
  const baseline = buildSimulatorBaseline();
  const visibilityScore = baseline.visibilityScore;
  const history = weeklyHistory(visibilityScore);
  const previousScore = history[history.length - 2].score;
  const potential = simulate(allLeversOn(baseline.levers), baseline, baseline.assumptions);

  return {
    business: sampleBusiness,
    visibilityScore,
    previousScore,
    weeklyChange: visibilityScore - previousScore,
    history,
    appearances: visibility.appearances,
    checks: visibility.checks,
    firstPlaceCount: visibility.results.filter((r) => r.rank === 1).length,
    strengths: strengthsFrom(visibility),
    weaknesses: visibility.reasons.slice(0, 3).map((reason) => ({
      ruleId: reason.ruleId,
      title: reason.text,
      count: reason.count,
      opportunityId: reason.opportunityId,
    })),
    potentialScore: potential.visibilityAfter,
    potentialRevenuePerMonth: potential.revenueDeltaPerMonth,
  };
}

// 8 weeks, oldest first, ending with this week's calculated score.
function weeklyHistory(thisWeekScore: number): WeeklyScore[] {
  const scores = [...pastWeeklyScores, thisWeekScore];
  const end = new Date(`${thisWeekStart}T00:00:00Z`);
  return scores.map((score, i) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - 7 * (scores.length - 1 - i));
    return { weekStart: date.toISOString().slice(0, 10), score };
  });
}

function strengthsFrom(visibility: Unsourced<VisibilityReport>): Strength[] {
  const { results, checks, byAssistant, prompts: allPrompts } = visibility;
  const firstPlace = results.filter((r) => r.rank === 1).length;
  const best = [...byAssistant].sort((a, b) => b.appearanceRate - a.appearanceRate)[0];
  const alwaysNamed = allPrompts.filter((p) =>
    results.filter((r) => r.promptId === p.promptId).every((r) => r.appeared),
  );
  return [
    {
      title: "Often recommended first",
      detail: `Named first in ${firstPlace} of ${checks} tracked AI answers.`,
    },
    {
      title: `Strongest with ${best.name}`,
      detail: `Appears in ${best.appearances} of ${best.checks} of its answers.`,
    },
    {
      title: "Every assistant names you for some questions",
      detail: `All ${byAssistant.length} assistants recommend you for ${alwaysNamed.length} tracked questions, such as "${alwaysNamed[0]?.text ?? "none"}".`,
    },
  ];
}
