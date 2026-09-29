// A rule-based coach that needs no AI. It spots what the question is about by
// keywords, then builds the answer from the current dashboard data, so every
// number in it matches the rest of the app.
import { formatChange, formatPercent, formatUsd } from "../format";
import type { CoachReply, CoachSourceChip, Opportunity, ReasonCode } from "../schema";
import { allLeversOn, simulate } from "../simulator";
import type { CoachContext, CoachProvider } from "./types";

export type IntentId =
  | "what_if"
  | "increase_sales"
  | "why_not_appearing"
  | "vs_competitors"
  | "biggest_gap"
  | "weekly_change"
  | "revenue"
  | "accuracy"
  | "fallback";

type Answer = Pick<CoachReply, "text" | "sources">;

interface Intent {
  id: Exclude<IntentId, "fallback">;
  keywords: string[];
  answer: (ctx: CoachContext, question: string) => Answer;
}

// Order matters only for ties: the intent listed first wins.
const INTENTS: Intent[] = [
  {
    id: "what_if",
    keywords: ["what if", "what happens if", "simulate", "if i fix", "if i add", "if i improve"],
    answer: (ctx, question) => {
      const opportunity = mentionedOpportunity(question, ctx) ?? topByLift(ctx)[0];
      const result = simulate({ [opportunity.id]: 1 }, ctx.baseline, ctx.baseline.assumptions);
      return {
        text:
          `If you fully complete "${opportunity.title}", the simulator estimates your AI Visibility Score ` +
          `goes from ${result.visibilityBefore} to ${result.visibilityAfter}, about ` +
          `${formatUsd(result.revenueDeltaPerMonth)} more in sales per month. ` +
          `Effort: ${opportunity.effort}. First step: ${opportunity.steps[0]}`,
        sources: [
          chip("Opportunity", `${opportunity.title} (+${opportunity.liftPoints} pts)`),
          chip("Simulator", `${result.visibilityBefore} → ${result.visibilityAfter}`),
        ],
      };
    },
  },
  {
    id: "increase_sales",
    keywords: ["increase sales", "more sales", "sell more", "grow", "more customers", "boost"],
    answer: (ctx) => {
      const [first, second] = topByLift(ctx);
      const all = simulate(allLeversOn(ctx.baseline.levers), ctx.baseline, ctx.baseline.assumptions);
      return {
        text:
          `Your biggest levers are "${first.title}" (+${first.liftPoints} points, ${first.effort} effort) ` +
          `and "${second.title}" (+${second.liftPoints} points, ${second.effort} effort). Doing all ` +
          `${ctx.opportunities.opportunities.length} opportunities could lift your AI Visibility Score from ` +
          `${all.visibilityBefore} to ${all.visibilityAfter}, worth about ${formatUsd(all.revenueDeltaPerMonth)} ` +
          `a month in extra sales.`,
        sources: [
          chip("Top opportunity", first.title),
          chip("Potential", `${all.visibilityAfter}/100, +${formatUsd(all.revenueDeltaPerMonth)}/mo`),
        ],
      };
    },
  },
  {
    id: "why_not_appearing",
    keywords: ["why", "not showing", "not appearing", "missing", "don't show", "left out", "invisible"],
    answer: (ctx) => {
      const { checks, appearances, reasons } = ctx.visibility;
      const top = reasons.slice(0, 3);
      return {
        text:
          `You were missing from ${checks - appearances} of ${checks} tracked AI answers. The most common ` +
          `reasons: ${top.map((r) => `${r.text} (${r.count} answers)`).join(" ")}`,
        sources: [
          chip("Tracked answers", `${appearances} of ${checks} include you`),
          ...top.map((r) => chip("Reason", `${r.code} × ${r.count}`)),
        ],
      };
    },
  },
  {
    id: "vs_competitors",
    keywords: ["competitor", "compare", "versus", " vs", "national", "similar business", "peers", "other stores"],
    answer: (ctx) => {
      const { shares, entities } = ctx.market;
      const name = ctx.overview.business.name;
      const leader = [...entities].sort((a, b) => b.mentions - a.mentions)[0];
      return {
        text:
          `In the tracked AI answers, national chains get ${formatPercent(shares.national)} of mentions, ` +
          `similar small businesses ${formatPercent(shares.peers)}, and ${name} ` +
          `${formatPercent(shares.thisBusiness)}. The most-mentioned business is ${leader.name} ` +
          `(${leader.mentions} mentions). Rankings are neutral: businesses can't pay to be recommended, ` +
          `so the way to gain ground is better data, reviews, and policies.`,
        sources: [
          chip("National share", formatPercent(shares.national)),
          chip("Peer share", formatPercent(shares.peers)),
          chip("Your share", formatPercent(shares.thisBusiness)),
        ],
      };
    },
  },
  {
    id: "biggest_gap",
    keywords: ["biggest gap", "gap", "weakness", "weakest", "biggest problem", "fix first"],
    answer: (ctx) => {
      const weakness = ctx.overview.weaknesses[0];
      const fix = opportunityById(ctx, weakness.opportunityId);
      return {
        text:
          `Your biggest gap: ${weakness.title} It affected ${weakness.count} tracked answers. ` +
          `The fix is "${fix.title}" (+${fix.liftPoints} points, ${fix.effort} effort). ` +
          `Start here: ${fix.steps[0]}`,
        sources: [
          chip("Weakness", `${weakness.code} × ${weakness.count}`),
          chip("Fix", `${fix.title} (+${fix.liftPoints} pts)`),
        ],
      };
    },
  },
  {
    id: "weekly_change",
    keywords: ["this week", "last week", "week", "trend", "change", "progress"],
    answer: (ctx) => {
      const { visibilityScore, previousScore, weeklyChange, history } = ctx.overview;
      const direction = weeklyChange > 0 ? "up" : weeklyChange < 0 ? "down" : "flat";
      return {
        text:
          `Your AI Visibility Score is ${visibilityScore}/100 this week, ${direction} ` +
          `${formatChange(weeklyChange)} from ${previousScore} last week. Over ${history.length} weeks ` +
          `it moved from ${history[0].score} to ${visibilityScore}.`,
        sources: [
          chip("This week", `${visibilityScore}/100`),
          chip("Change", `${formatChange(weeklyChange)} pts`),
          chip(`${history.length}-week start`, `${history[0].score}/100`),
        ],
      };
    },
  },
  {
    id: "revenue",
    keywords: ["revenue", "money", "worth", "dollar", "income", "$"],
    answer: (ctx) => {
      const { assumptions } = ctx.baseline;
      const all = simulate(allLeversOn(ctx.baseline.levers), ctx.baseline, assumptions);
      return {
        text:
          `Each AI Visibility point is estimated at ${formatUsd(assumptions.revenuePerVisibilityPoint)} a month. ` +
          `Completing every opportunity (${all.visibilityBefore} → ${all.visibilityAfter}) is worth about ` +
          `${formatUsd(all.revenueDeltaPerMonth)} a month. This is an estimate based on: ` +
          `${assumptions.explanation.map((a) => a.label.toLowerCase()).join(", ")}. You can change these assumptions.`,
        sources: [
          chip("Per point", `${formatUsd(assumptions.revenuePerVisibilityPoint)}/mo`),
          chip("All opportunities", `+${formatUsd(all.revenueDeltaPerMonth)}/mo`),
        ],
      };
    },
  },
  {
    id: "accuracy",
    keywords: ["wrong", "accura", "incorrect", "outdated", "mistake", "hallucinat", "stock"],
    answer: (ctx) => {
      const accuracyCodes: ReasonCode[] = ["OUTDATED_INFO", "STOCK_STATUS_UNKNOWN", "UNCLEAR_POLICY"];
      const found = ctx.visibility.reasons.filter((r) => accuracyCodes.includes(r.code));
      if (found.length === 0) {
        return {
          text: "No tracked answers were affected by outdated details, unclear policies, or unknown stock.",
          sources: [chip("Tracked answers", `${ctx.visibility.checks}`)],
        };
      }
      return {
        text:
          `Detail problems cost you these answers: ${found.map((r) => `${r.text} (${r.count})`).join(" ")} ` +
          `Fixing them is covered by: ${[...new Set(found.map((r) => opportunityById(ctx, r.opportunityId).title))].join("; ")}.`,
        sources: found.map((r) => chip("Reason", `${r.code} × ${r.count}`)),
      };
    },
  },
];

/** Questions offered as one-tap chips in the coach UI. Each maps to one intent. */
export const SUGGESTED_QUESTIONS: { question: string; intent: IntentId }[] = [
  { question: "How can I increase sales?", intent: "increase_sales" },
  { question: "Why am I not showing up in AI answers?", intent: "why_not_appearing" },
  { question: "How do I compare to competitors?", intent: "vs_competitors" },
  { question: "What's my biggest gap?", intent: "biggest_gap" },
  { question: "What if I fix my structured data?", intent: "what_if" },
  { question: "How did I do this week?", intent: "weekly_change" },
  { question: "How much revenue could better AI visibility bring me?", intent: "revenue" },
  { question: "Are AI assistants getting my details wrong?", intent: "accuracy" },
];

/** Which intent a question matches: the one with the most keyword hits. */
export function matchIntent(question: string): IntentId {
  const q = question.toLowerCase();
  let best: Intent | null = null;
  let bestHits = 0;
  for (const intent of INTENTS) {
    const hits = intent.keywords.filter((k) => q.includes(k)).length;
    if (hits > bestHits) {
      best = intent;
      bestHits = hits;
    }
  }
  return best?.id ?? "fallback";
}

export const sampleCoach: CoachProvider = {
  async ask(question, _history, context) {
    const intentId = matchIntent(question);
    const intent = INTENTS.find((i) => i.id === intentId);
    const answer = intent ? intent.answer(context, question) : fallbackAnswer(context);
    return { ...answer, source: "sample" };
  },
};

function fallbackAnswer(ctx: CoachContext): Answer {
  const { business, visibilityScore } = ctx.overview;
  return {
    text:
      `I'm not sure about that one yet. I can help ${business.name} with sales ideas, why you're missing ` +
      `from AI answers, how you compare to competitors, your biggest gap, what-if scenarios, weekly changes, ` +
      `revenue estimates, and wrong details. Try one of the suggested questions.`,
    sources: [chip("AI Visibility Score", `${visibilityScore}/100`)],
  };
}

function topByLift(ctx: CoachContext): Opportunity[] {
  return [...ctx.opportunities.opportunities].sort((a, b) => b.liftPoints - a.liftPoints);
}

function opportunityById(ctx: CoachContext, id: string): Opportunity {
  const found = ctx.opportunities.opportunities.find((o) => o.id === id);
  if (!found) throw new Error(`Unknown opportunity ${id}`);
  return found;
}

// Finds the opportunity whose title words (5+ letters) best match the question.
function mentionedOpportunity(question: string, ctx: CoachContext): Opportunity | undefined {
  const q = question.toLowerCase();
  let best: Opportunity | undefined;
  let bestHits = 0;
  for (const opportunity of ctx.opportunities.opportunities) {
    const words = opportunity.title.toLowerCase().split(/\W+/).filter((w) => w.length >= 5);
    const hits = words.filter((w) => q.includes(w)).length;
    if (hits > bestHits) {
      best = opportunity;
      bestHits = hits;
    }
  }
  return best;
}

function chip(label: string, value: string): CoachSourceChip {
  return { label, value };
}
