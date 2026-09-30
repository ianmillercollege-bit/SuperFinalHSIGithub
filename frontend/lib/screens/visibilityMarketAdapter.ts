// Builds the props for VisibilityView and MarketView from lib/sample/visibilityMarket.ts (sample-only data).
// Never edit that file or retype its numbers: every figure below is derived from its selectors.
import * as D from '../sample/visibilityMarket';
import type { ReasonGroup, PromptRow } from '../../components/screens/VisibilityView';
import type { MarketRow } from '../../components/screens/MarketView';
import type { StatData } from '../../components/screens/ui';

const pct = (v: number) => `${Math.round(v * 100)}%`;

// reasonHref: map a reason's opportunityKey to a real route, or return undefined to hide the "Fix it" link.
export function visibilityProps(reasonHref?: (opportunityKey: string) => string | undefined) {
  const per = D.perAssistant();
  const best = per.reduce((a, b) => (b.recommended > a.recommended ? b : a));
  const stats: StatData[] = [
    { id: 'freq', label: 'Recommendation frequency', value: pct(D.recommendationFrequency()), note: `${D.recommendedAnswers()} of ${D.totalAnswers()} answers named you` },
    { id: 'tested', label: 'Questions tested', value: String(D.prompts.length), note: `Across ${D.assistants.length} AI assistants` },
    { id: 'missed', label: 'Answers that missed you', value: String(D.missedAnswers()), note: 'Each has a reason and a fix' },
    { id: 'best', label: 'Strongest assistant', value: best.assistant, note: `${best.recommended} of ${best.total} questions (${pct(best.frequency)})` },
  ];
  const prompts: PromptRow[] = D.prompts.map((p) => ({ id: p.id, text: p.text, category: p.category, cells: p.results.map((r) => ({ assistant: r.assistant, rank: r.rank, reason: r.reason })) }));
  const reasons: ReasonGroup[] = D.missedByReason().map((r) => ({ key: r.reason, label: r.label, count: r.count, opportunityTitle: r.opportunityTitle, opportunityHref: reasonHref?.(r.opportunityKey) }));
  return { stats, assistants: [...D.assistants], prompts, reasons, missedTotal: D.missedAnswers() };
}

export function marketProps(businessName: string, simulatorHref?: string) {
  const rows: MarketRow[] = D.marketWithYou().map((m) => ({
    id: m.id, name: m.group === 'you' ? businessName : m.name, group: m.group, score: m.score,
    averageRank: m.averageRank ?? 0, shareOfVoice: m.shareOfVoice, frequency: m.recommendationFrequency ?? 0,
  }));
  const rep = D.representation();
  const to = D.currentScore + D.totalLiftPoints();
  const after = D.marketWithYou(to);
  const aheadOf = after.filter((m) => m.group === 'national' && m.score < to).sort((a, b) => b.score - a.score)[0]?.name;
  const stats: StatData[] = [
    { id: 'small', label: 'Rank among small businesses', value: `${D.rankAmongSmallBusinesses()} of ${rows.filter((r) => r.group !== 'national').length}`, note: 'Compared by visibility score' },
    { id: 'all', label: 'Rank overall', value: `${D.rankOverall()} of ${rows.length}`, note: 'Small businesses and national brands' },
    { id: 'sov', label: 'Your share of voice', value: pct(rep.you), note: 'Of all AI recommendations we tracked' },
  ];
  return {
    stats, rows, representation: rep,
    landing: { fromScore: D.currentScore, toScore: to, rankFrom: D.rankOverall(), rankTo: D.rankOverall(to), rankSmallTo: D.rankAmongSmallBusinesses(to), total: rows.length, aheadOf, simulatorHref },
  };
}
