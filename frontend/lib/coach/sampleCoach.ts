import { actionFor, analyze, cheapestRoute } from './insightEngine';
import type { ActionItem, Coach, CoachContext, CoachReply, CoachRequest, CoachSource, CoachTurn } from './types';

// Deterministic coach built only from the context: no API, no tokens. It is the free demo mode, the fallback when a live
// model is unavailable, and the source of the default action plan. Answers are question-specific: each one carries its own
// action cards, follow-ups ("tell me more about move 2") use the conversation, and topics drill into real shopper questions.
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

export function buildPlan(ctx: CoachContext): ActionItem[] {
  return analyze(ctx).recommendations;
}

export interface Answer { answer: string; sources: CoachSource[]; actions?: ActionItem[] }

type Intent = 'analysis' | 'growth' | 'missing' | 'market' | 'claims' | 'trust' | 'trend' | 'plan' | 'forecast' | 'product' | 'assistants' | 'explain' | 'overview';
const INTENTS: [Intent, RegExp][] = [
  ['analysis', /analy[sz]|insight|bottleneck|hidden|pattern|ratio|biggest|coach me|advice|what should i (do|focus|fix)|priorit|30 day|thirty day|plan|steps|what now|next step|top actions|actions? (i|we) should|which actions/i],
  ['forecast', /next (year|month|quarter)|forecast|predict|projection|will my|customers did i lose|customers.*lost|profit|margin|churn|how much will/i],
  ['product', /how does (cirqo|the checker|it) (work|check)|what is cirqo|who approves|pay to rank|paid placement|can i pay|how do you check/i],
  ['assistants', /which (assistant|ai)|worst|best (for me)?.*assistant|assistant.*(worst|best|focus)|focus on first/i],
  ['market', /compar|competitor|national|peer|market|rank|share of voice/i],
  ['missing', /missing|missed|appear|show up|mention|why not|not shown|recommend(ed)? me/i],
  ['claims', /claim|approve|incident|escalat|outstanding|reviewed/i],
  ['trust', /accura|hallucin|wrong|trust|correct|false alarm|resolve|making (things )?up|made up|fabricat|\blies?\b|incorrect|inaccurate/i],
  ['trend', /week|trend|change|last month|progress|improving/i],
  ['growth', /revenue|sales|money|grow|increase|sell|income|earn|cheap|easiest|quick|fastest|least|gain|points|one hour/i],
  ['plan', /plan|action|steps|priorit|next|what should|todo|to do/i],
  ['explain', /explain|dashboard|summar|overview|what does this|new to/i],
];
const detect = (q: string): Intent => INTENTS.find(([, re]) => re.test(q))?.[0] ?? 'overview';

const QUICK = /cheap|least|easiest|quick|hour|low effort|fastest|lowest/i;
const MONEY = /revenue|money|sales|dollar|income|earn|\$/i;
// keyword -> which miss reason it is about
const TOPICS: [RegExp, RegExp][] = [
  [/structured|\bspecs?\b|schema|product data|product pages?/i, /structured/i],
  [/reviews?\b|ratings?|testimonial/i, /review/i],
  [/return|refund/i, /return/i],
  [/in stock|stock status|inventory/i, /stock/i],
  [/\bfaq\b|competitor cited|cited instead/i, /competitor/i],
];
const ORD: Record<string, number> = { first: 1, second: 2, third: 3 };
const moveRef = (q: string): number | undefined => {
  const d = /(?:move|step|option|number|no\.?|#)\s*([1-3])\b/i.exec(q); if (d) return Number(d[1]);
  const o = /\b(?:the\s+)?(first|second|third)\s+(?:one|move|step|option)\b|\babout\s+the\s+(first|second|third)\b/i.exec(q);
  return o ? ORD[(o[1] ?? o[2]).toLowerCase()] : undefined;
};
// Only a bare follow-up counts: "why?", "tell me more", "how do I start". Real questions that begin with "why" are not follow-ups.
const VAGUE_FOLLOWUP = /^\s*(tell me more|more detail|elaborate|explain (that|it|this)|why\??|why (is|does) that|how (do|would) i (start|do that|begin)|go on)\s*[.!?]*\s*$/i;

export function answerFor(question: string, ctx: CoachContext, historyIn: CoachTurn[] = []): Answer {
  const history = Array.isArray(historyIn) ? historyIn : [];
  const v = ctx.visibility, m = ctx.market, r = ctx.revenue, opp = ctx.opportunities ?? [];
  const sources: CoachSource[] = [];
  const src = (label: string, value: string) => sources.push({ label, value });
  const need = (what: string): Answer => ({ answer: `I need ${what} to answer that. Once it is available I can be specific.`, sources });
  const an = analyze(ctx);
  const q = question.trim();

  // ----- reusable answer builders -----
  const engineAnswer = (): Answer => {
    if (!an.bottleneck || an.recommendations.length === 0) return need('your visibility and opportunity data');
    src('Visibility score', String(v!.score)); src('Biggest bottleneck', an.bottleneck.title); an.recommendations.forEach((a, i) => src(`Move ${i + 1}`, a.title));
    const moves = an.recommendations.map((a, i) => `${i + 1}) ${a.title}: ${a.expectedImpact.split(';')[0]}, ${a.effort.toLowerCase()} effort.`).join('\n');
    return { answer: `Your biggest bottleneck is ${an.bottleneck.title.toLowerCase()}. ${an.bottleneck.why}\n\nWhat the numbers say:\n${an.patterns.slice(0, 3).map((p) => `- ${p}`).join('\n')}\n\nThree moves, in order:\n${moves}\n\n${an.closer ? `Candidly, you are closer than the score suggests: ${an.closer.charAt(0).toLowerCase()}${an.closer.slice(1)} ` : ''}Start with move 1 this week and re-check your score in 7 days.`, sources, actions: an.recommendations };
  };
  const quickAnswer = (): Answer => {
    const low = opp.filter((o) => o.effort === 'Low').sort((a, b) => b.liftPoints - a.liftPoints);
    if (!v || low.length === 0) return engineAnswer();
    src('Visibility score', String(v.score)); low.forEach((o) => src(o.title, `+${o.liftPoints} points`));
    return { answer: `The lowest-effort gaps are ${low.map((o) => `${o.title.toLowerCase()} (+${pts(o.liftPoints)}, about ${usd(o.revenuePerMonth)}/month)`).join(', ')}. Together they add ${pts(low.reduce((s, o) => s + o.liftPoints, 0))}, about ${usd(low.reduce((s, o) => s + o.revenuePerMonth, 0))} a month (estimate). Start with "${low[0].title.toLowerCase()}".`, sources, actions: low.slice(0, 3).map((o, i) => actionFor(ctx, o, undefined, `act_${i + 1}`)) };
  };
  const moneyAnswer = (): Answer => {
    if (!v || !r || an.recommendations.length === 0) return engineAnswer();
    const byRev = [...opp].sort((a, b) => b.revenuePerMonth - a.revenuePerMonth).slice(0, 3), byVpe = an.recommendations;
    const i = byRev.findIndex((o, k) => o.title !== byVpe[k]?.title);
    const total = byVpe.reduce((s, a) => s + (opp.find((o) => o.title === a.title)?.revenuePerMonth ?? 0), 0);
    src('Revenue estimate', `${usd(r.estimatePerMonth)}/month`); byRev.forEach((o) => src(o.title, `${usd(o.revenuePerMonth)}/month`));
    const trade = i >= 0 && byVpe[i] ? ` Ranked by dollars alone, "${byRev[i].title}" (${usd(byRev[i].revenuePerMonth)}) comes before "${byVpe[i].title}" (${usd(opp.find((o) => o.title === byVpe[i].title)!.revenuePerMonth)}), but it needs ${byRev[i].effort.toLowerCase()} effort against ${byVpe[i].effort.toLowerCase()}, so the order below weighs both.` : '';
    return { answer: `Where the money is: each visibility point is worth about ${usd(r.perVisibilityPoint)}/month (estimate), and your three best gaps are worth ${usd(total)}/month together.${trade}\n\nDo them in this order:\n${byVpe.map((a, k) => `${k + 1}) ${a.title}: ${a.expectedImpact.split(';')[0]}, ${a.effort.toLowerCase()} effort.`).join('\n')}\n\nThe revenue figure is an illustrative estimate from your stated assumptions, not a forecast. Start with move 1 this week.`, sources, actions: byVpe };
  };
  const moveDetail = (n: number): Answer => {
    const rec = an.recommendations[n - 1];
    if (!rec || !v) return need('your visibility and opportunity data');
    const cum = an.recommendations.slice(0, n).reduce((s, a) => s + (opp.find((o) => o.title === a.title)?.liftPoints ?? 0), 0), next = an.recommendations[n];
    src(`Move ${n}`, rec.title); src('Effort', rec.effort);
    return { answer: `Move ${n}: ${rec.title} (${rec.effort.toLowerCase()} effort). ${rec.expectedImpact.split(';')[0]}.\n\nWhy it ranks here: ${rec.why}\n\nHow to do it:\n${rec.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nHow you will know it worked: re-check your ${rec.metric}. ${n === 1 ? `Finishing this takes the score from ${v.score} to ${v.score + cum}.` : `Finishing moves 1 to ${n} takes the score from ${v.score} to ${v.score + cum}.`}${next ? ` Next up: move ${n + 1}, ${next.title}.` : ''}`, sources, actions: [rec] };
  };
  const menu = (lead: string): Answer => {
    const bits = [an.bottleneck ? `your biggest bottleneck (${an.bottleneck.title.toLowerCase()}${v?.missReasons[0] ? `, ${v.missReasons[0].count} of ${v.answersMissed} misses` : ''})` : '', an.rivalRoute ? `how to pass ${an.rivalRoute.rival} (${an.rivalRoute.gap} points ahead)` : '', ctx.claims ? `your ${ctx.claims.outstanding} waiting claims` : ''].filter(Boolean);
    if (!v || bits.length === 0) return { answer: 'I can help with visibility, accuracy, claims, market position and revenue. Try: "How can I increase sales?" or "Why am I missing from some AI answers?"', sources };
    return { answer: `${lead} I can go deeper on ${bits.map((b, i) => `(${String.fromCharCode(97 + i)}) ${b}`).join(', ')}, or on any assistant, competitor or fix by name. Just ask in your own words.`, sources };
  };

  // ----- follow-ups and named things come first, because they are the most specific -----
  const lastCoach = [...history].reverse().find((t) => t.role === 'coach');
  const ref = moveRef(q);
  if (ref !== undefined) return moveDetail(ref);
  const topicHit = TOPICS.find(([re]) => re.test(q));
  if (VAGUE_FOLLOWUP.test(q) && !topicHit) return lastCoach ? moveDetail(1) : menu('I do not have an earlier answer to build on yet.');

  const rival = ctx.competitors?.find((c) => { const ql = q.toLowerCase(), n = c.name.toLowerCase(); return ql.includes(n) || (n.split(' ')[0].length >= 5 && !n.startsWith('national') && ql.includes(n.split(' ')[0])); });
  if (rival && v) {
    const d = rival.score - v.score, you = m?.shareOfVoice, to = m?.scoreIfAllGapsClosed, route = d > 0 ? cheapestRoute(opp, d) : undefined;
    src(`${rival.name} score`, String(rival.score)); src('Your score', String(v.score));
    return { answer: `${rival.name} (${rival.type}) scores ${rival.score} against your ${v.score}, so ${d > 0 ? `it is ${d} points ahead` : d < 0 ? `you are ${-d} points ahead` : 'you are level'}. It averages rank ${rival.averageRank} in AI answers, holds ${pct(rival.shareOfVoice)} of recommendations${you !== undefined ? ` (you hold ${pct(you)})` : ''}, and is recommended in ${pct(rival.recommendationFrequency)} of answers (you: ${pct(v.recommendationFrequency)}).${route ? ` The cheapest way past them is ${route.set.map((o) => `"${o.title}"`).join(' plus ')} (+${pts(route.sum)}, reaching ${v.score + route.sum}).` : to !== undefined && d > 0 ? ` Closing every gap would take your score to ${to}, still ${rival.score - to} points short of ${rival.name}.` : ''}`, sources, actions: route?.set.map((o, i) => actionFor(ctx, o, undefined, `act_${i + 1}`)) };
  }
  const named = /assistant\s+([a-d])\b/i.exec(q);
  const asst = named && ctx.assistants?.find((a) => a.name.toLowerCase() === `assistant ${named[1].toLowerCase()}`);
  if (asst && v) {
    const missed = asst.answersTested - asst.answersRecommended, share = missed / Math.max(1, v.answersMissed), lead = v.missReasons[0], leadOpp = opp.find((o) => o.title === lead?.fix);
    src(asst.name, pct(asst.frequency));
    return { answer: `${asst.name} named you in ${asst.answersRecommended} of ${asst.answersTested} answers (${pct(asst.frequency)}), so it produced ${missed} of your ${v.answersMissed} misses (${pct(share)}).${asst.missedQuestions?.length ? ` It missed you on ${asst.missedQuestions.slice(0, 2).map((x) => `"${x}"`).join(' and ')}.` : ''}${lead ? ` The biggest overall reason is ${lead.label.toLowerCase()}, so start with "${lead.fix.toLowerCase()}".` : ''}`, sources, actions: leadOpp ? [actionFor(ctx, leadOpp)] : undefined };
  }
  if (topicHit && v) {
    const reason = v.missReasons.find((x) => topicHit[1].test(x.label)), o = reason && opp.find((x) => x.title === reason.fix);
    if (reason && o) {
      const ex = (reason.examples ?? []).slice(0, 2), idx = an.ranking.findIndex((x) => x.title === o.title);
      src(reason.label, `${reason.count} answers`); src('Fix', o.title);
      return { answer: `${reason.label} explains ${reason.count} of ${v.answersMissed} missed answers (${pct(reason.count / v.answersMissed)}).${ex.length ? ` It cost you on questions like ${ex.map((e) => `"${e.question}" (missed on ${e.assistants.join(' and ')})`).join(' and ')}.` : ''}\n\nThe fix: "${o.title}" is worth +${pts(o.liftPoints)}, about ${usd(o.revenuePerMonth)}/month (estimate), at ${o.effort.toLowerCase()} effort.${o.firstStep ? ` Start here: ${o.firstStep}` : ''}\n\n${idx === 0 ? 'This is your top move.' : idx > 0 && idx < 3 ? `In your ranking it is move ${idx + 1} of 3.` : 'It ranks below your top 3 moves, so finish those first.'}`, sources, actions: [actionFor(ctx, o)] };
    }
  }

  // ----- general intents -----
  const intent = detect(q);
  switch (intent) {
    case 'forecast':
      if (r) src('Revenue estimate', `${usd(r.estimatePerMonth)}/month`);
      return { answer: `I can't tell that from your dashboard data. It covers visibility, competitors, claims, accuracy and an illustrative revenue estimate, but not sales history, customers, costs or forecasts.${r ? ` The closest figure I have is the revenue estimate of ${usd(r.estimatePerMonth)}/month at your current score (estimate, not a forecast).` : ''} If your store data were connected I could answer this.`, sources, actions: [] };
    case 'product':
      return { answer: 'CIRQO tracks how AI shopping assistants describe your business and checks what they say against your verified facts. AI extracts the claims and plain code decides whether each one is correct, incorrect, outdated or unverifiable. Mistakes open incidents, low-risk fixes are applied automatically, and high-risk fixes wait for a named person to approve. Safety or legal issues are only escalated, every action is logged, and ranking is neutral: nothing can be paid for.', sources, actions: [] };
    case 'assistants': {
      const a = [...(ctx.assistants ?? [])].sort((x, y) => y.frequency - x.frequency);
      if (a.length < 2) return need('per-assistant data');
      const best = a[0], worst = a[a.length - 1], reason = v?.missReasons[0], o = reason && opp.find((x) => x.title === reason.fix);
      a.forEach((x) => src(x.name, pct(x.frequency)));
      return { answer: `${worst.name} recommends you least (${pct(worst.frequency)} of its answers) and ${best.name} most (${pct(best.frequency)}), a gap of ${Math.round((best.frequency - worst.frequency) * 100)} percentage points. Start with ${worst.name}${reason ? `: the biggest reason you are missed overall is ${reason.label.toLowerCase()} (${reason.count} answers), and the fix is "${reason.fix.toLowerCase()}"` : ''}.`, sources, actions: o ? [actionFor(ctx, o)] : undefined };
    }
    case 'explain':
      if (!v) return need('dashboard data');
      src('Visibility score', String(v.score));
      return { answer: `Your AI Visibility Score is ${v.score} out of 100. It shows how often and how well AI shopping assistants recommend you, and it was ${v.previousScore} last week. Assistants named you in ${pct(v.recommendationFrequency)} of tested answers${m ? `, which ranks you ${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount} among small businesses` : ''}. ${r ? `The revenue figure of ${usd(r.estimatePerMonth)}/month is an illustrative estimate, not your real sales. ` : ''}${ctx.claims ? `Claims are wrong facts assistants may show, and ${ctx.claims.outstanding} are waiting for your approval. ` : ''}Opportunity gaps list the fixes, and the action plan turns them into steps.`, sources, actions: [] };
    case 'analysis': case 'plan': case 'growth':
      if (QUICK.test(q)) return quickAnswer();
      if (MONEY.test(q) && intent !== 'analysis') return moneyAnswer();
      return intent === 'growth' && (!v || !opp.length) ? need('your visibility and opportunity data') : engineAnswer();
    case 'missing': {
      if (!v) return need('visibility data');
      src('Answers that missed you', `${v.answersMissed} of ${v.answersTested}`); const rs = v.missReasons.slice(0, 3); rs.forEach((x) => src(x.label, `${x.count} answers`));
      const o = rs[0] && opp.find((x) => x.title === rs[0].fix);
      return { answer: `You were not named in ${v.answersMissed} of ${v.answersTested} answers (${pct(v.recommendationFrequency)} recommendation frequency). ${rs.length ? `The biggest reasons are ${rs.map((x) => `${x.label.toLowerCase()} (${x.count} answers)`).join(', ')}.` : ''} Each reason has a matching fix in Opportunity gaps.`, sources, actions: o ? [actionFor(ctx, o)] : undefined };
    }
    case 'market': {
      if (!m) return need('market comparison data');
      src('Rank among small businesses', `${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount}`); src('Rank overall', `${m.rankOverall} of ${m.businessCount}`); src('Share of voice', pct(m.shareOfVoice));
      return { answer: `You rank ${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount} among small businesses and ${m.rankOverall} of ${m.businessCount} overall, with a ${pct(m.shareOfVoice)} share of AI recommendations. National brands hold ${pct(m.nationalShare)}.${m.scoreIfAllGapsClosed ? ` If you close every gap your score would reach ${m.scoreIfAllGapsClosed}, ranking you ${m.rankOverallIfAllGapsClosed} of ${m.businessCount} overall (estimate).` : ''}`, sources, actions: an.rivalRoute?.set.map((o, i) => actionFor(ctx, o, undefined, `act_${i + 1}`)) };
    }
    case 'claims': {
      const c = ctx.claims; if (!c) return need('claims data');
      src('Outstanding claims', String(c.outstanding)); src('Reviewed in 30 days', String(c.reviewedLast30Days));
      return { answer: `You have ${c.outstanding} claims waiting for approval and ${c.reviewedLast30Days} reviewed in the last 30 days. Open Outstanding Claims to approve or reject each item; safety and legal items go to a person.`, sources, actions: c.outstanding > 0 ? [{ id: 'act_1', title: 'Clear the claims waiting for approval', why: `${c.outstanding} claims are waiting against ${c.reviewedLast30Days} reviewed in the last 30 days.`, expectedImpact: `${c.outstanding} open items resolved`, effort: 'Low', metric: 'Outstanding claims', steps: ['Open Outstanding Claims.', 'Approve or reject each item with a reason.'], basedOn: ['Claims'] }] : [] };
    }
    case 'trust': {
      const t = ctx.trust; if (!t) return need('accuracy data');
      src('Accuracy', pct(t.accuracyRate)); src('Hallucination rate', pct(t.hallucinationRate)); src('Time to resolve', `${t.timeToResolveHours} hours`);
      return { answer: `AI answers about you are ${pct(t.accuracyRate)} accurate, up from ${pct(t.accuracyRateStart)} ${t.days} days ago. The hallucination rate is ${pct(t.hallucinationRate)} and issues take about ${t.timeToResolveHours} hours to resolve.`, sources, actions: [] };
    }
    case 'trend': {
      const w = ctx.weeklyScores; if (!w || w.length < 2 || !v) return need('a few weeks of visibility scores');
      src('Score now', String(w[w.length - 1])); src('Score first week', String(w[0]));
      return { answer: `Your visibility score moved from ${w[0]} to ${w[w.length - 1]} over ${w.length} weeks, and ${v.score - v.previousScore >= 0 ? 'rose' : 'fell'} ${Math.abs(v.score - v.previousScore)} points last week.`, sources, actions: [] };
    }
    default: {
      const words = q.split(/\s+/).filter(Boolean).length;
      if (v && (words <= 4 || /^(fix|help|advice|ok|okay|so|and)\b/i.test(q))) return menu('That is a broad one.');
      if (!v) return { answer: 'I can help with visibility, accuracy, claims, market position and revenue. Try: "How can I increase sales?" or "Why am I missing from some AI answers?"', sources, actions: [] };
      src('Visibility score', String(v.score)); src('Recommendation frequency', pct(v.recommendationFrequency));
      return { answer: `Your AI Visibility Score is ${v.score}, and assistants recommended you in ${pct(v.recommendationFrequency)} of tested answers. I can help with revenue, missed answers, market position, claims or accuracy. Try: "How can I increase sales?"`, sources, actions: [] };
    }
  }
}

export const sampleCoach: Coach = {
  async ask(req: CoachRequest): Promise<CoachReply> {
    const a = answerFor(req.question, req.context, req.history);
    return { answer: a.answer, sources: a.sources, actions: a.actions ?? [], mode: 'sample', verified: true, generatedAt: new Date().toISOString() };
  },
};
