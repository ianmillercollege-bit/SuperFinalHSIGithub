import { analyze } from './insightEngine';
import type { CoachContext } from './types';

// Insights computed by CODE from the context (comparisons, shares, gaps, quick wins). The model quotes and explains
// them instead of doing arithmetic, so the numbers are right by construction and pass verification.
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const W = { Low: 1, Medium: 2, High: 3 } as const;

export function deriveFacts(ctx: CoachContext): string[] {
  const f: string[] = [];
  const v = ctx.visibility, m = ctx.market, r = ctx.revenue, t = ctx.trust, c = ctx.claims, opp = ctx.opportunities ?? [];
  if (v) {
    f.push(`You were named in ${v.answersRecommended} of ${v.answersTested} tested answers (${pct(v.recommendationFrequency)}); ${v.answersMissed} answers missed you.`);
    if (v.strongestAssistant && v.weakestAssistant && v.strongestAssistant.name !== v.weakestAssistant.name) {
      const gap = Math.round((v.strongestAssistant.frequency - v.weakestAssistant.frequency) * 100);
      f.push(`${v.strongestAssistant.name} recommends you most (${pct(v.strongestAssistant.frequency)} of its answers) and ${v.weakestAssistant.name} least (${pct(v.weakestAssistant.frequency)}), a gap of ${gap} percentage points.`);
    }
    v.missReasons.forEach((x) => f.push(`${x.label} explains ${x.count} of ${v.answersMissed} missed answers (${pct(x.count / v.answersMissed)}); the matching fix is "${x.fix}".`));
    v.missReasons.slice(0, 2).forEach((x) => { const ex = (x.examples ?? []).slice(0, 2); if (ex.length) f.push(`Examples of "${x.label}" misses: ${ex.map((e) => `"${e.question}" on ${e.assistants.join(' and ')}`).join('; ')}.`); });
    f.push(`Your visibility score moved from ${v.previousScore} to ${v.score} last week.`);
  }
  if (ctx.weeklyScores && ctx.weeklyScores.length > 1) f.push(`Over ${ctx.weeklyScores.length} weeks your score moved from ${ctx.weeklyScores[0]} to ${ctx.weeklyScores[ctx.weeklyScores.length - 1]}.`);
  if (opp.length) {
    const best = [...opp].sort((a, b) => b.liftPoints / W[b.effort] - a.liftPoints / W[a.effort] || b.revenuePerMonth - a.revenuePerMonth)[0];
    const lift = opp.reduce((s, o) => s + o.liftPoints, 0), money = opp.reduce((s, o) => s + o.revenuePerMonth, 0);
    f.push(`Best value for effort: "${best.title}" (+${best.liftPoints} points, about ${usd(best.revenuePerMonth)}/month estimate, ${best.effort} effort).`);
    f.push(`All ${opp.length} opportunity gaps together: +${lift} points, about ${usd(money)}/month (estimate).`);
    const low = opp.filter((o) => o.effort === 'Low');
    if (low.length) f.push(`The ${low.length} low-effort gaps alone: +${low.reduce((s, o) => s + o.liftPoints, 0)} points, about ${usd(low.reduce((s, o) => s + o.revenuePerMonth, 0))}/month (estimate).`);
  }
  if (r) {
    f.push(`Estimated revenue is ${usd(r.estimatePerMonth)}/month; each visibility point is worth about ${usd(r.perVisibilityPoint)}/month (estimate, from ${r.queriesPerMonth.toLocaleString('en-US')} AI-driven shopper questions per month, ${r.conversionPct}% conversion and a ${usd(r.averageOrderValue)} average order).`);
  }
  if (m) {
    f.push(`You rank ${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount} small businesses and ${m.rankOverall} of ${m.businessCount} overall.`);
    f.push(`Share of AI recommendations: you ${pct(m.shareOfVoice)}, small-business peers ${pct(m.peerShare)}, national brands ${pct(m.nationalShare)}.`);
    if (m.scoreIfAllGapsClosed !== undefined) f.push(`If every gap were closed your score would reach ${m.scoreIfAllGapsClosed}, ranking ${m.rankOverallIfAllGapsClosed} of ${m.businessCount} overall and ${m.rankSmallIfAllGapsClosed} of ${m.smallBusinessCount} among small businesses (estimate).`);
  }
  if (t) f.push(`AI answers about you are ${pct(t.accuracyRate)} accurate, up from ${pct(t.accuracyRateStart)} ${t.days} days ago; the hallucination rate is ${pct(t.hallucinationRate)} and issues take about ${t.timeToResolveHours} hours to resolve.`);
  if (ctx.competitors?.length && v) {
    const above = (type: string) => ctx.competitors!.filter((x) => x.type === type && x.score > v.score).sort((a, b) => a.score - b.score)[0];
    const sb = above('small business'), nb = above('national brand');
    if (sb) f.push(`The nearest small business above you is ${sb.name} (score ${sb.score}, ${sb.score - v.score} points ahead).`);
    if (nb) f.push(`The nearest national brand above you is ${nb.name} (score ${nb.score}, ${nb.score - v.score} points ahead).`);
    const below = ctx.competitors.filter((x) => x.type === 'small business' && x.score < v.score).sort((a, b) => b.score - a.score)[0];
    if (below) f.push(`You are ahead of ${below.name} (score ${below.score}) by ${v.score - below.score} points.`);
    const to = m?.scoreIfAllGapsClosed;
    const passed = to !== undefined ? ctx.competitors.filter((x) => x.score > v.score && x.score < to).sort((a, b) => b.score - a.score).map((x) => x.name) : [];
    if (to !== undefined && passed.length) f.push(`Closing every gap (score ${to}) would put you ahead of ${passed.join(', ')} (estimate).`);
  }
  if (ctx.assistants?.length) f.push(`Recommendation rate by assistant: ${ctx.assistants.map((a) => `${a.name} ${pct(a.frequency)}`).join(', ')}.`);
  (ctx.topMissedQuestions ?? []).slice(0, 3).forEach((q) => f.push(`"${q.question}" missed you on ${q.missedBy.length} of ${ctx.assistants?.length ?? 4} assistants${q.reason ? ` (${q.reason})` : ''}.`));
  if (c) f.push(`${c.outstanding} claims are waiting for approval and ${c.reviewedLast30Days} were reviewed in the last 30 days.`);
  f.push(...analyze(ctx).facts);
  if (ctx.sampleSections?.length) f.unshift(`Sections that are sample data: ${ctx.sampleSections.join(', ')}.`);   // first, so it is never cut
  return f.slice(0, 44);
}
