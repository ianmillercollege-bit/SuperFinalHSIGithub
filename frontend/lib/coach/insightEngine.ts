import type { ActionItem, CoachContext } from './types';

// Free, unlimited, instant analysis: plain code, no API and no tokens. It works like the growth coach brief:
// find ratios and hidden patterns, isolate the single highest-impact bottleneck, give exactly 3 concrete moves.
// Every number it writes comes from the context or is a simple sum/ratio of it, and it also emits `facts` so the
// numbers are in the context for the verifier (and for a live model, if one is ever plugged in).
const W = { Low: 1, Medium: 2, High: 3 } as const;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const x1 = (n: number) => `${Math.round(n * 10) / 10}x`;
const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

type Opp = NonNullable<CoachContext['opportunities']>[number];

export interface Analysis {
  ranking: Opp[];                    // all gaps, best return per unit of effort first
  rivalRoute?: { rival: string; gap: number; set: Opp[]; sum: number };
  bottleneck?: { title: string; why: string };
  patterns: string[];
  recommendations: ActionItem[];     // exactly 3 when the data allows
  facts: string[];
  closer?: string;                   // the encouraging, candid last line
}


// Cheapest set of gaps whose combined lift passes a score gap (strictly more than the gap).
export function cheapestRoute(opps: Opp[], gap: number): { set: Opp[]; sum: number } | undefined {
  let best: { set: Opp[]; sum: number; eff: number; rev: number } | undefined;
  const n = Math.min(opps.length, 8);
  for (let mask = 1; mask < 1 << n; mask++) {
    const set = opps.filter((_, i) => mask & (1 << i)); const sum = set.reduce((s, o) => s + o.liftPoints, 0);
    if (sum <= gap) continue;
    const eff = set.reduce((s, o) => s + W[o.effort], 0), rev = set.reduce((s, o) => s + o.revenuePerMonth, 0);
    if (!best || eff < best.eff || (eff === best.eff && (set.length < best.set.length || (set.length === best.set.length && rev > best.rev)))) best = { set, sum, eff, rev };
  }
  return best && { set: best.set, sum: best.sum };
}

// One gap as an action card. Pass `cum` (running total of lift) to show where the score lands.
export function actionFor(ctx: CoachContext, o: Opp, cum?: number, id = 'act_1'): ActionItem {
  const v = ctx.visibility, reason = v?.missReasons.find((r) => r.fix === o.title), lead = v?.missReasons[0]?.fix === o.title;
  const share = reason && v && v.answersMissed ? `${reason.label} explains ${reason.count} of ${v.answersMissed} ${lead ? '' : 'missed answers '}(${pct(reason.count / v.answersMissed)}).` : undefined;
  return {
    id, title: o.title,
    why: share ? (lead ? `Your largest source of misses: ${share}` : share) : o.why ?? `Worth about ${usd(o.revenuePerMonth)}/month for ${o.effort.toLowerCase()} effort (estimate).`,
    expectedImpact: `+${pts(o.liftPoints)}, about ${usd(o.revenuePerMonth)}/month (estimate)${cum !== undefined && v ? `; running total +${pts(cum)}, score ${v.score + cum}` : ''}`,
    effort: o.effort, metric: 'AI Visibility Score',
    steps: [o.firstStep ?? 'Assign an owner and finish the first step this week.', reason ? `Re-run your shopper questions in 7 days and confirm the "${reason.label.toLowerCase()}" misses drop.` : 'Re-check your score a week after finishing.'],
    basedOn: ['Opportunity gaps', 'AI Visibility'],
  };
}

export function analyze(ctx: CoachContext): Analysis {
  const v = ctx.visibility, m = ctx.market, opps = ctx.opportunities ?? [];
  const out: Analysis = { ranking: [], patterns: [], recommendations: [], facts: [] };
  if (!v || opps.length === 0) return out;

  // 1) Return per unit of effort: the ratio that decides what to do first.
  const ranked = opps.map((o) => ({ o, vpe: o.revenuePerMonth / W[o.effort] })).sort((a, b) => b.vpe - a.vpe || b.o.liftPoints - a.o.liftPoints);
  const top = ranked.slice(0, 3);
  out.ranking = ranked.map((r) => r.o);
  if (ranked.length > 1) {
    const ratio = ranked[0].vpe / ranked[1].vpe;
    const p = `"${ranked[0].o.title}" returns ${usd(ranked[0].vpe)} per unit of effort against ${usd(ranked[1].vpe)} for "${ranked[1].o.title}" (estimate), ${x1(ratio)} the next best.`;
    out.facts.push(`Value per unit of effort: ${p}`);
  }

  // 2) Where the misses concentrate.
  const reason = v.missReasons[0];
  const lead = reason ? opps.find((o) => o.title === reason.fix) ?? top[0].o : top[0].o;
  const leadVpe = lead.revenuePerMonth / W[lead.effort];
  const nextBest = ranked.find((r) => r.o.title !== lead.title)?.vpe;
  if (reason) {
    const share = reason.count / v.answersMissed;
    const why = `${reason.label} explains ${reason.count} of ${v.answersMissed} missed answers (${pct(share)}), and fixing it returns ${usd(leadVpe)} per unit of effort${nextBest ? `, ${x1(leadVpe / nextBest)} the next best` : ''} (estimate).`;
    out.bottleneck = { title: reason.label, why };
    out.facts.push(`Bottleneck: ${why}`);
  } else out.bottleneck = { title: lead.title, why: `"${lead.title}" is the best-value fix: about ${usd(lead.revenuePerMonth)}/month for ${lead.effort} effort (estimate).` };

  // 3) One assistant carrying a disproportionate share of the misses.
  const a = ctx.assistants;
  if (a && a.length > 1 && v.answersMissed > 0) {
    const weak = [...a].sort((p, q) => p.frequency - q.frequency)[0];
    const missed = weak.answersTested - weak.answersRecommended, share = missed / v.answersMissed, fair = 1 / a.length;
    if (share > fair) { const p = `${weak.name} produces ${missed} of your ${v.answersMissed} misses (${pct(share)}) while being 1 of ${a.length} assistants (${pct(fair)} of the field), ${x1(share / fair)} its share.`; out.patterns.push(p); out.facts.push(`Skew: ${p}`); }
  }

  // 4) National brands over-index; you under-index.
  if (m && ctx.competitors?.length) {
    const nat = ctx.competitors.filter((c) => c.type === 'national brand').length, field = nat / m.businessCount, fair = 1 / m.businessCount;
    if (nat > 0 && m.nationalShare > field) { const p = `National brands are ${pct(field)} of the field (${nat} of ${m.businessCount}) but hold ${pct(m.nationalShare)} of recommendations, ${x1(m.nationalShare / field)} their share, while you hold ${pct(m.shareOfVoice)} against an even split of ${pct(fair)}.`; out.patterns.push(p); out.facts.push(`Representation: ${p}`); }
  }

  // 5) Momentum, and the cheapest route past the next small-business rival.
  const w = ctx.weeklyScores; const pace = w && w.length > 1 ? (w[w.length - 1] - w[0]) / (w.length - 1) : undefined;
  if (w && pace !== undefined) out.facts.push(`Your pace is ${Math.round(pace * 10) / 10} points a week (${w[0]} to ${w[w.length - 1]} over ${w.length} weeks).`);
  const rival = ctx.competitors?.filter((c) => c.type === 'small business' && c.score > v.score).sort((p, q) => p.score - q.score)[0];
  if (rival) {
    const gap = rival.score - v.score; const best = cheapestRoute(opps, gap);
    if (best) {
      const weeks = pace && pace > 0 ? ` At your current pace that takes about ${Math.ceil((gap + 1) / pace)} weeks.` : '';
      const p = `${rival.name} is ${gap} points ahead (score ${rival.score}). The cheapest way past it is ${best.set.map((o) => `"${o.title}"`).join(' plus ')} (+${pts(best.sum)}, reaching ${v.score + best.sum}).${weeks}`;
      out.patterns.unshift(p); out.facts.push(`Rival: ${p}`); out.rivalRoute = { rival: rival.name, gap, set: best.set, sum: best.sum };
    }
  }

  top.forEach(({ o, vpe }) => out.facts.push(`Return per unit of effort: "${o.title}" ${usd(vpe)} (estimate).`));
  // Exactly 3 recommendations, best return per unit of effort first, with the running total.
  let cum = 0;
  out.recommendations = top.map(({ o }, i) => { cum += o.liftPoints; return actionFor(ctx, o, i > 0 ? cum : undefined, `act_${i + 1}`); });
  const total = top.reduce((s, t) => s + t.o.liftPoints, 0), rev = top.reduce((s, t) => s + t.o.revenuePerMonth, 0), reach = v.score + total;
  if (ctx.competitors && m) {
    const rank = 1 + ctx.competitors.filter((c) => c.score > reach).length;
    const line = `The top ${top.length} fixes together add ${pts(total)} to reach ${reach}, about ${usd(rev)}/month (estimate), ranking ${rank} of ${m.businessCount} overall.`;
    out.facts.push(line); out.closer = line;
  }
  if (ctx.claims && ctx.claims.reviewedLast30Days > 0) out.facts.push(`${ctx.claims.outstanding} claims wait against ${ctx.claims.reviewedLast30Days} reviewed in 30 days, about ${Math.ceil((ctx.claims.outstanding / ctx.claims.reviewedLast30Days) * 30)} days of work at the current pace.`);
  return out;
}
