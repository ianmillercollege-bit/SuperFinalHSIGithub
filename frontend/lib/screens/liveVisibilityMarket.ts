// Turns the live contract data (GET /visibility/summary and GET /answers, DECISIONS.md #27) into the props
// the kit's VisibilityView and MarketView expect. Nothing here is sample data and no figure is invented.
import type { MarketRow } from "@/components/screens/MarketView";
import type { PromptRow } from "@/components/screens/VisibilityView";
import type { StatData } from "@/components/screens/ui";
import type { Answer, VisibilitySummary } from "@/lib/types";

const pct = (v: number) => `${Math.round(v * 100)}%`;
// DECISIONS.md #13: score = round(rate x 100).
const score = (rate: number) => Math.round(rate * 100);

export function liveVisibilityProps(summary: VisibilitySummary, answers: Answer[]) {
  const assistants = summary.byAssistant.map((a) => a.name);
  const byQuestion = new Map<string, Answer[]>();
  for (const a of answers) byQuestion.set(a.queryText, [...(byQuestion.get(a.queryText) ?? []), a]);

  // A question only becomes a row when every assistant has an answer recorded for it, so no cell is ever guessed.
  const prompts: PromptRow[] = [];
  for (const [text, list] of byQuestion) {
    const cells = assistants.map((name) => list.find((a) => a.assistantName === name));
    if (cells.some((c) => c === undefined)) continue;
    prompts.push({
      id: list[0].answerId,
      text,
      category: "Shopper question",
      cells: cells.map((c) => ({ assistant: c!.assistantName, rank: c!.brandMentioned ? c!.rank : null })),
    });
  }

  const missed = answers.filter((a) => !a.brandMentioned).length;
  const best = summary.byAssistant.reduce((x, y) => (y.visibilityRate > x.visibilityRate ? y : x), summary.byAssistant[0]);
  const stats: StatData[] = [
    { id: "freq", label: "Recommendation frequency", value: pct(summary.visibilityRate), note: `Share of tracked answers naming ${summary.brandName}, last ${summary.periodDays} days` },
    { id: "tested", label: "Questions tested", value: String(byQuestion.size), note: `Across ${assistants.length} AI assistants` },
    { id: "missed", label: "Answers that missed you", value: String(missed), note: `Out of ${answers.length} recent answers` },
    { id: "best", label: "Strongest assistant", value: best?.name ?? "None yet", note: best ? `Named you in ${pct(best.visibilityRate)} of answers` : "No assistants tracked yet" },
  ];
  return { stats, assistants, prompts, reasons: [], missedTotal: missed, hiddenQuestions: byQuestion.size - prompts.length };
}

export function liveMarketProps(summary: VisibilitySummary, businessName: string) {
  const rows: MarketRow[] = [
    { id: "you", name: businessName, group: "you", score: score(summary.visibilityRate), averageRank: summary.averageRank, shareOfVoice: summary.shareOfVoice, frequency: summary.visibilityRate },
    ...summary.competitors.map((c) => ({
      id: c.brandName, name: c.brandName, group: "peer" as const, score: score(c.visibilityRate), averageRank: c.averageRank, shareOfVoice: c.shareOfVoice, frequency: c.visibilityRate,
    })),
  ];
  const place = [...rows].sort((a, b) => b.score - a.score).findIndex((r) => r.group === "you") + 1;
  const peers = summary.competitors.reduce((sum, c) => sum + c.shareOfVoice, 0);
  const stats: StatData[] = [
    { id: "rank", label: "Your rank", value: `${place} of ${rows.length}`, note: "Compared by visibility score" },
    { id: "score", label: "Your visibility score", value: String(score(summary.visibilityRate)), note: `Last ${summary.periodDays} days` },
    { id: "sov", label: "Your share of voice", value: pct(summary.shareOfVoice), note: "Of all brand mentions in tracked answers" },
  ];
  return { stats, rows, representation: { national: 0, peers, you: summary.shareOfVoice } };
}
