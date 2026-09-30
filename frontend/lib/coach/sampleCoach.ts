import type { ActionItem, Coach, CoachContext, CoachReply, CoachRequest, CoachSource } from './types';

// Deterministic coach built only from the context. It is the offline mode, the fallback when the AI is
// unavailable or fails verification, and the default action plan before anyone asks the model.
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const W = { Low: 1, Medium: 2, High: 3 } as const;
const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

export function buildPlan(ctx: CoachContext): ActionItem[] {
  const out: Omit<ActionItem, 'id'>[] = [];
  const opps = [...(ctx.opportunities ?? [])].sort((a, b) => b.liftPoints / W[b.effort] - a.liftPoints / W[a.effort] || b.revenuePerMonth - a.revenuePerMonth).slice(0, 3);
  for (const o of opps) out.push({
    title: o.title, why: o.why ?? `Closing this gap is worth about ${usd(o.revenuePerMonth)} a month (estimate).`,
    expectedImpact: `+${o.liftPoints} ${o.liftPoints === 1 ? 'point' : 'points'}, about ${usd(o.revenuePerMonth)}/month (estimate)`,
    effort: o.effort, metric: 'AI Visibility Score',
    steps: [o.firstStep ?? 'Assign an owner and finish the first step this week.', 'Re-run your shopper questions next week to confirm the change.'], basedOn: ['Opportunity gaps'],
  });
  const top = ctx.visibility?.missReasons?.[0];
  if (top && !opps.some((o) => o.title === top.fix)) out.push({
    title: top.fix, why: `${top.label} caused ${top.count} of the ${ctx.visibility!.answersMissed} answers that missed you.`,
    expectedImpact: `Addresses ${top.count} missed answers`, effort: 'Medium', metric: 'Recommendation frequency',
    steps: [`Start with the pages behind "${top.label}".`], basedOn: ['AI Visibility'],
  });
  if (ctx.claims && ctx.claims.outstanding > 0) out.push({
    title: 'Clear the claims waiting for approval', why: `${ctx.claims.outstanding} claims are waiting, and each one is a wrong fact shoppers may still see.`,
    expectedImpact: `${ctx.claims.outstanding} open items resolved`, effort: 'Low', metric: 'Outstanding claims',
    steps: ['Open Outstanding Claims.', 'Approve or reject each item with a reason.'], basedOn: ['Claims'],
  });
  return out.slice(0, 5).map((a, i) => ({ ...a, id: `act_${i + 1}` }));
}

type Intent = 'growth' | 'missing' | 'market' | 'claims' | 'trust' | 'trend' | 'plan' | 'forecast' | 'product' | 'assistants' | 'explain' | 'overview';
const INTENTS: [Intent, RegExp][] = [
  ['forecast', /next (year|month|quarter)|forecast|predict|projection|will my|customers did i lose|customers.*lost|profit|margin|churn|how much will/i],
  ['product', /how does (cirqo|the checker|it) (work|check)|what is cirqo|who approves|pay to rank|paid placement|can i pay|how do you check/i],
  ['assistants', /which (assistant|ai)|worst|best (for me)?.*assistant|assistant.*(worst|best|focus)|focus on first/i],
  ['market', /compar|competitor|national|peer|market|rank|share of voice/i],
  ['missing', /missing|missed|appear|show up|mention|why not|not shown|recommend(ed)? me/i],
  ['claims', /claim|approve|incident|escalat|outstanding|reviewed/i],
  ['trust', /accura|hallucin|wrong|trust|correct|false alarm|resolve/i],
  ['trend', /week|trend|change|last month|progress|improv/i],
  ['growth', /revenue|sales|money|grow|increase|sell|income|earn|cheap|easiest|quick|fastest|least|gain|points|one hour/i],
  ['plan', /plan|action|steps|priorit|next|what should|todo|to do/i],
  ['explain', /explain|dashboard|summar|overview|what does this|new to/i],
];
const detect = (q: string): Intent => INTENTS.find(([, re]) => re.test(q))?.[0] ?? 'overview';

export function answerFor(question: string, ctx: CoachContext): { answer: string; sources: CoachSource[] } {
  const v = ctx.visibility, m = ctx.market, r = ctx.revenue, opp = ctx.opportunities ?? [];
  const sources: CoachSource[] = [];
  const src = (label: string, value: string) => sources.push({ label, value });
  const top = [...opp].sort((a, b) => b.liftPoints - a.liftPoints).slice(0, 3);
  const totalLift = opp.reduce((s, o) => s + o.liftPoints, 0), totalRev = opp.reduce((s, o) => s + o.revenuePerMonth, 0);
  const rival = ctx.competitors?.find((c) => { const q = question.toLowerCase(), n = c.name.toLowerCase(); return q.includes(n) || (n.split(' ')[0].length >= 5 && !n.startsWith('national') && q.includes(n.split(' ')[0])); });
  if (rival && v) {
    const d = rival.score - v.score, you = ctx.market?.shareOfVoice, to = ctx.market?.scoreIfAllGapsClosed;
    src(`${rival.name} score`, String(rival.score)); src('Your score', String(v.score));
    return { answer: `${rival.name} (${rival.type}) scores ${rival.score} against your ${v.score}, so ${d > 0 ? `it is ${d} points ahead` : d < 0 ? `you are ${-d} points ahead` : 'you are level'}. It averages rank ${rival.averageRank} in AI answers, holds ${pct(rival.shareOfVoice)} of recommendations${you !== undefined ? ` (you hold ${pct(you)})` : ''}, and is recommended in ${pct(rival.recommendationFrequency)} of answers (you: ${pct(v.recommendationFrequency)}).${to !== undefined && d > 0 ? ` Closing every gap would take your score to ${to}${to > rival.score ? `, past ${rival.name}` : `, still ${rival.score - to} points short of ${rival.name}`} (estimate).` : ''}`, sources };
  }
  switch (detect(question)) {
    case 'forecast': {
      if (r) src('Revenue estimate', `${usd(r.estimatePerMonth)}/month`);
      return { answer: `I can't tell that from your dashboard data. It covers visibility, competitors, claims, accuracy and an illustrative revenue estimate, but not sales history, customers, costs or forecasts.${r ? ` The closest figure I have is the revenue estimate of ${usd(r.estimatePerMonth)}/month at your current score (estimate, not a forecast).` : ''} If your store data were connected I could answer this.`, sources };
    }
    case 'product':
      return { answer: 'CIRQO tracks how AI shopping assistants describe your business and checks what they say against your verified facts. AI extracts the claims and plain code decides whether each one is correct, incorrect, outdated or unverifiable. Mistakes open incidents, low-risk fixes are applied automatically, and high-risk fixes wait for a named person to approve. Safety or legal issues are only escalated, every action is logged, and ranking is neutral: nothing can be paid for.', sources };
    case 'assistants': {
      const a = [...(ctx.assistants ?? [])].sort((x, y) => y.frequency - x.frequency);
      if (a.length < 2) return { answer: 'I do not have per-assistant data yet.', sources };
      const best = a[0], worst = a[a.length - 1], reason = v?.missReasons[0];
      a.forEach((x) => src(x.name, pct(x.frequency)));
      return { answer: `${worst.name} recommends you least (${pct(worst.frequency)} of its answers) and ${best.name} most (${pct(best.frequency)}), a gap of ${Math.round((best.frequency - worst.frequency) * 100)} percentage points. Start with ${worst.name}${reason ? `: the biggest reason you are missed overall is ${reason.label.toLowerCase()} (${reason.count} answers), and the fix is "${reason.fix.toLowerCase()}"` : ''}.`, sources };
    }
    case 'explain': {
      if (!v) return { answer: 'I do not have dashboard data yet.', sources };
      src('Visibility score', String(v.score));
      return { answer: `Your AI Visibility Score is ${v.score} out of 100. It shows how often and how well AI shopping assistants recommend you, and it was ${v.previousScore} last week. Assistants named you in ${pct(v.recommendationFrequency)} of tested answers${m ? `, which ranks you ${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount} among small businesses` : ''}. ${r ? `The revenue figure of ${usd(r.estimatePerMonth)}/month is an illustrative estimate, not your real sales. ` : ''}${ctx.claims ? `Claims are wrong facts assistants may show, and ${ctx.claims.outstanding} are waiting for your approval. ` : ''}Opportunity gaps list the fixes, and the action plan turns them into steps.`, sources };
    }
    case 'growth': {
      if (!v || !top.length) return { answer: 'I need your visibility and opportunity data to give revenue advice. Once it is available I can rank the changes by impact.', sources };
      src('Visibility score', String(v.score)); if (r) src('Revenue estimate', `${usd(r.estimatePerMonth)}/month`); top.forEach((o) => src(o.title, `+${o.liftPoints} points`));
      if (/cheap|least|easiest|quick|hour|low effort|fastest|lowest/i.test(question)) {
        const low = opp.filter((o) => o.effort === 'Low').sort((a, b) => b.liftPoints - a.liftPoints);
        if (low.length) return { answer: `The lowest-effort gaps are ${low.map((o) => `${o.title.toLowerCase()} (+${pts(o.liftPoints)}, about ${usd(o.revenuePerMonth)}/month)`).join(', ')}. Together they add ${pts(low.reduce((s, o) => s + o.liftPoints, 0))}, about ${usd(low.reduce((s, o) => s + o.revenuePerMonth, 0))} a month (estimate). Start with "${low[0].title.toLowerCase()}".`, sources };
      }
      return { answer: `The fastest way to grow is to raise your AI Visibility Score, now ${v.score} out of 100. Your top changes are ${top.map((o) => `${o.title.toLowerCase()} (+${pts(o.liftPoints)}, about ${usd(o.revenuePerMonth)}/month)`).join(', ')}. Together all ${opp.length} gaps add ${totalLift} points and about ${usd(totalRev)} a month (estimate, not a guarantee).`, sources };
    }
    case 'missing': {
      if (!v) return { answer: 'I do not have visibility data yet, so I cannot say why you are missing from answers.', sources };
      src('Answers that missed you', `${v.answersMissed} of ${v.answersTested}`); const rs = v.missReasons.slice(0, 3); rs.forEach((x) => src(x.label, `${x.count} answers`));
      return { answer: `You were not named in ${v.answersMissed} of ${v.answersTested} answers (${pct(v.recommendationFrequency)} recommendation frequency). ${rs.length ? `The biggest reasons are ${rs.map((x) => `${x.label.toLowerCase()} (${x.count} answers)`).join(', ')}.` : ''} Each reason has a matching fix in Opportunity gaps.`, sources };
    }
    case 'market': {
      if (!m) return { answer: 'I do not have market comparison data yet.', sources };
      src('Rank among small businesses', `${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount}`); src('Rank overall', `${m.rankOverall} of ${m.businessCount}`); src('Share of voice', pct(m.shareOfVoice));
      return { answer: `You rank ${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount} among small businesses and ${m.rankOverall} of ${m.businessCount} overall, with a ${pct(m.shareOfVoice)} share of AI recommendations. National brands hold ${pct(m.nationalShare)}.${m.scoreIfAllGapsClosed ? ` If you close every gap your score would reach ${m.scoreIfAllGapsClosed}, ranking you ${m.rankOverallIfAllGapsClosed} of ${m.businessCount} overall (estimate).` : ''}`, sources };
    }
    case 'claims': {
      if (!ctx.claims) return { answer: 'I do not have claims data yet.', sources };
      src('Outstanding claims', String(ctx.claims.outstanding)); src('Reviewed in 30 days', String(ctx.claims.reviewedLast30Days));
      return { answer: `You have ${ctx.claims.outstanding} claims waiting for approval and ${ctx.claims.reviewedLast30Days} reviewed in the last 30 days. Open Outstanding Claims to approve or reject each item; safety and legal items go to a person.`, sources };
    }
    case 'trust': {
      if (!ctx.trust) return { answer: 'I do not have accuracy data yet.', sources };
      const t = ctx.trust; src('Accuracy', pct(t.accuracyRate)); src('Hallucination rate', pct(t.hallucinationRate)); src('Time to resolve', `${t.timeToResolveHours} hours`);
      return { answer: `AI answers about you are ${pct(t.accuracyRate)} accurate, up from ${pct(t.accuracyRateStart)} ${t.days} days ago. The hallucination rate is ${pct(t.hallucinationRate)} and issues take about ${t.timeToResolveHours} hours to resolve.`, sources };
    }
    case 'trend': {
      const w = ctx.weeklyScores; if (!w || w.length < 2 || !v) return { answer: 'I need a few weeks of visibility scores to describe the trend.', sources };
      src('Score now', String(w[w.length - 1])); src('Score first week', String(w[0]));
      return { answer: `Your visibility score moved from ${w[0]} to ${w[w.length - 1]} over ${w.length} weeks, and ${v.score - v.previousScore >= 0 ? 'rose' : 'fell'} ${Math.abs(v.score - v.previousScore)} points last week.`, sources };
    }
    case 'plan': {
      const plan = buildPlan(ctx); plan.forEach((a) => src(a.title, a.effort));
      return { answer: plan.length ? `Here is what I would do first: ${plan.map((a, i) => `${i + 1}. ${a.title}`).join(' ')}. They are ordered by impact and effort, and the checklist is on your dashboard.` : 'I do not have enough data to build a plan yet.', sources };
    }
    default: {
      if (!v) return { answer: 'I can help with visibility, accuracy, claims, market position and revenue. Try: "How can I increase sales?" or "Why am I missing from some AI answers?"', sources };
      src('Visibility score', String(v.score)); src('Recommendation frequency', pct(v.recommendationFrequency));
      return { answer: `Your AI Visibility Score is ${v.score}, and assistants recommended you in ${pct(v.recommendationFrequency)} of tested answers. I can help with revenue, missed answers, market position, claims or accuracy. Try: "How can I increase sales?"`, sources };
    }
  }
}

export const sampleCoach: Coach = {
  async ask(req: CoachRequest): Promise<CoachReply> {
    const { answer, sources } = answerFor(req.question, req.context);
    return { answer, sources, actions: buildPlan(req.context), mode: 'sample', verified: true, generatedAt: new Date().toISOString() };
  },
};
