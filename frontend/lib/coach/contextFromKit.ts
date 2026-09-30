import * as D from '../sample/visibilityMarket';
import type { DashboardViewModel } from '../dashboard/types';
import type { OpportunityDetail } from '../../components/screens/OpportunityGapsView';
import { DEFAULT_ASSUMPTIONS, simulate } from '../screens/simulate';
import { deriveFacts } from './facts';
import type { CoachContext } from './types';

// Builds the coach context from the kit's sample data. Replace pieces with live data as endpoints ship:
// pass real claims counts, and swap D.* for the live visibility and market data.
export function contextFromKit(opts: {
  businessName: string; category?: string; vm: DashboardViewModel; opportunities: OpportunityDetail[];
  claims?: { outstanding: number; reviewedLast30Days: number }; asOf?: string; dataLabel?: CoachContext['dataLabel'];
  live?: { claims?: { outstanding: number; reviewedLast30Days: number }; trust?: NonNullable<CoachContext['trust']> };   // pass sections that come from real endpoints
}): CoachContext {
  const { vm } = opts;
  const per = D.perAssistant();
  const best = per.reduce((a, b) => (b.frequency > a.frequency ? b : a)), worst = per.reduce((a, b) => (b.frequency < a.frequency ? b : a));
  const to = D.currentScore + D.totalLiftPoints();
  const rep = D.representation();
  const revStat = vm.stats.find((s) => s.id === 'revenue');
  const revenueNumber = revStat ? Number(revStat.value.replace(/[^0-9.]/g, '')) : undefined;
  const trust = vm.trust?.series;
  const acc = trust?.find((s) => s.key === 'accuracy'), hall = trust?.find((s) => s.key === 'hallucination'), res = trust?.find((s) => s.key === 'resolve');
  const last = (a?: { values: number[] }) => (a ? a.values[a.values.length - 1] : undefined);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const rate = (n: number) => Math.round(n * 100) / 100;   // rates as shown on the dashboard: 0.58 = 58%
  const ctx: CoachContext = {
    business: { name: opts.businessName, category: opts.category },
    asOf: opts.asOf ?? new Date().toISOString().slice(0, 10),
    dataLabel: opts.dataLabel ?? 'sample',
    visibility: {
      score: D.currentScore, previousScore: vm.score ? vm.score.value - vm.score.changeVsLastWeek : D.currentScore,
      recommendationFrequency: rate(D.recommendationFrequency()),
      answersTested: D.totalAnswers(), answersRecommended: D.recommendedAnswers(), answersMissed: D.missedAnswers(),
      strongestAssistant: { name: best.assistant, frequency: rate(best.frequency) }, weakestAssistant: { name: worst.assistant, frequency: rate(worst.frequency) },
      missReasons: D.missedByReason().map((r) => ({ label: r.label, count: r.count, fix: r.opportunityTitle, examples: D.prompts.filter((p) => p.results.some((x) => x.reason === r.reason && x.rank === null)).map((p) => ({ question: p.text, assistants: p.results.filter((x) => x.reason === r.reason && x.rank === null).map((x) => x.assistant) })).sort((a, b) => b.assistants.length - a.assistants.length).slice(0, 3) })),
    },
    market: {
      rankAmongSmallBusinesses: D.rankAmongSmallBusinesses(), smallBusinessCount: D.market.filter((m) => m.group !== 'national').length,
      rankOverall: D.rankOverall(), businessCount: D.market.length, shareOfVoice: rep.you, nationalShare: rep.national, peerShare: rep.peers,
      scoreIfAllGapsClosed: to, rankOverallIfAllGapsClosed: D.rankOverall(to), rankSmallIfAllGapsClosed: D.rankAmongSmallBusinesses(to),
    },
    opportunities: opts.opportunities.map((o) => ({ title: o.title, effort: o.effort as 'Low' | 'Medium' | 'High', liftPoints: o.liftPoints, revenuePerMonth: o.revenuePerMonth, why: o.why, firstStep: o.step })),
    weeklyScores: vm.weeklyScores,
    claims: opts.live?.claims ?? opts.claims,
    competitors: D.marketWithYou().filter((m) => m.group !== 'you').map((m) => ({ name: m.name, type: m.group === 'peer' ? 'small business' as const : 'national brand' as const, score: m.score, averageRank: m.averageRank ?? 0, shareOfVoice: rate(m.shareOfVoice), recommendationFrequency: rate(m.recommendationFrequency ?? 0) })),
    assistants: per.map((a) => ({ name: a.assistant, frequency: rate(a.frequency), answersRecommended: a.recommended, answersTested: a.total, missedQuestions: D.prompts.filter((p) => p.results.find((x) => x.assistant === a.assistant)?.rank === null).map((p) => p.text).slice(0, 3) })),
    topMissedQuestions: D.prompts.map((p) => { const missed = p.results.filter((r) => r.rank === null); const top = missed.map((r) => r.reason).filter(Boolean) as D.ReasonCode[]; return { question: p.text, missedBy: missed.map((r) => r.assistant), reason: top[0] ? D.reasons[top[0]].label : undefined }; }).filter((q) => q.missedBy.length).sort((a, b) => b.missedBy.length - a.missedBy.length).slice(0, 5),
  };
  const per1 = simulate(D.currentScore, [], {}, DEFAULT_ASSUMPTIONS).perPoint;
  if (revenueNumber !== undefined) ctx.revenue = { estimatePerMonth: revenueNumber, perVisibilityPoint: Math.round(per1 * 100) / 100, queriesPerMonth: DEFAULT_ASSUMPTIONS.queries, conversionPct: DEFAULT_ASSUMPTIONS.conversionPct, averageOrderValue: DEFAULT_ASSUMPTIONS.orderValue };
  if (acc && hall && res) ctx.trust = { accuracyRate: rate(last(acc)!), hallucinationRate: rate(last(hall)!), timeToResolveHours: round1(last(res)!), days: acc.values.length, accuracyRateStart: rate(acc.values[0]) };
  if (opts.live?.trust) ctx.trust = opts.live.trust;
  const liveSet = new Set<string>([...(opts.live?.claims ? ['claims'] : []), ...(opts.live?.trust ? ['trust'] : [])]);
  ctx.sampleSections = ['visibility', 'market', 'opportunities', 'revenue', 'trust', 'claims'].filter((k) => !liveSet.has(k) && (ctx as unknown as Record<string, unknown>)[k] !== undefined);
  if (opts.dataLabel === undefined) ctx.dataLabel = liveSet.size === 0 ? 'sample' : ctx.sampleSections.length ? 'mixed' : 'live';
  ctx.derivedFacts = deriveFacts(ctx);
  return ctx;
}
