// The one place that turns the live visibility data (GET /visibility/summary and GET /answers, DECISIONS.md #27) into
// the figures every screen shows: the dashboard, AI Visibility, Market Position, the Growth Simulator and the AI Coach.
// Every screen reads these, so the same number can never come out two ways.
//
// AI Visibility Score = round(visibilityRate x 100) (DECISIONS.md #13). The rate is the summary's 30-day rate, which the
// backend computes from the recorded answers, so the counts below (n of m answers) add up to it.
import type { Answer, VisibilitySummary } from "../types";

/** GET /answers returns at most this many rows. */
export const ANSWERS_LIMIT = 100;

export interface AssistantFigures {
  name: string;
  /** 0..1, from the summary. */
  frequency: number;
  recommended: number;
  tested: number;
  missedQuestions: string[];
}

export interface LiveVisibility {
  score: number;
  /** 0..1, the summary's visibilityRate. */
  rate: number;
  brandName: string;
  periodDays: number;
  tested: number;
  recommended: number;
  missed: number;
  /** True when the answers list hit the API's row limit, so the counts may be short. */
  truncated: boolean;
  assistants: AssistantFigures[];
  /** Questions with at least one answer that did not name the business, most-missed first. */
  missedQuestions: { question: string; missedBy: string[] }[];
  shareOfVoice: number;
  competitors: { name: string; score: number; averageRank: number; shareOfVoice: number; frequency: number }[];
  averageRank: number;
}

export const scoreFromRate = (rate: number) => Math.round(rate * 100);

export function liveVisibility(summary: VisibilitySummary, answers: Answer[]): LiveVisibility {
  const recommended = answers.filter((a) => a.brandMentioned).length;
  const assistants: AssistantFigures[] = summary.byAssistant.map((a) => {
    const mine = answers.filter((x) => x.assistantId === a.assistantId);
    return {
      name: a.name,
      frequency: a.visibilityRate,
      recommended: mine.filter((x) => x.brandMentioned).length,
      tested: mine.length,
      missedQuestions: [...new Set(mine.filter((x) => !x.brandMentioned).map((x) => x.queryText))].slice(0, 3),
    };
  });
  const byQuestion = new Map<string, Set<string>>();
  for (const a of answers) if (!a.brandMentioned) byQuestion.set(a.queryText, (byQuestion.get(a.queryText) ?? new Set()).add(a.assistantName));
  return {
    score: scoreFromRate(summary.visibilityRate),
    rate: summary.visibilityRate,
    brandName: summary.brandName,
    periodDays: summary.periodDays,
    tested: answers.length,
    recommended,
    missed: answers.length - recommended,
    truncated: answers.length >= ANSWERS_LIMIT,
    assistants,
    missedQuestions: [...byQuestion].map(([question, who]) => ({ question, missedBy: [...who].sort() })).sort((a, b) => b.missedBy.length - a.missedBy.length || a.question.localeCompare(b.question)),
    shareOfVoice: summary.shareOfVoice,
    averageRank: summary.averageRank,
    competitors: summary.competitors.map((c) => ({ name: c.brandName, score: scoreFromRate(c.visibilityRate), averageRank: c.averageRank, shareOfVoice: c.shareOfVoice, frequency: c.visibilityRate })),
  };
}

/** Rank among the business and its competitors by score (1 = highest); ties share the better rank. */
export function rankByScore(score: number, competitors: { score: number }[]): number {
  return competitors.filter((c) => c.score > score).length + 1;
}
