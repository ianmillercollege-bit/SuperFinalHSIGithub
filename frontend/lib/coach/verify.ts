import type { ActionItem, CoachContext, CoachReply, CoachSource } from './types';

// "AI proposes, code decides": every metric-like number in the reply must exist in the data (or be a simple sum).
const NUM_RE = /(\$)?\s?(\d[\d,]*(?:\.\d+)?)\s?(%|pts?\b|points?\b|hours?\b|hrs?\b|days?\b|\/mo\b|\/month\b|x\b)?/gi;
const ORDINAL_AFTER = /^(st|nd|rd|th)\b/i;

export interface FoundNumber { raw: string; value: number }

export function extractMetricNumbers(text: string): FoundNumber[] {
  const out: FoundNumber[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const value = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    const after = text.slice((m.index ?? 0) + m[0].length);
    if (!m[3] && ORDINAL_AFTER.test(after)) continue;                 // 1st, 7th
    const before = text.slice(Math.max(0, (m.index ?? 0) - 1), m.index);
    if (/[-/:]/.test(before) && !m[1]) continue;                      // parts of dates and ranges
    const hasUnit = !!(m[1] || m[3]);
    const decimal = m[2].includes('.');
    const year = Number.isInteger(value) && value >= 1900 && value <= 2100 && !hasUnit;
    if (year) continue;
    if (hasUnit || decimal || value >= 10) out.push({ raw: m[0].trim(), value });   // small bare integers (steps, ranks) are ignored
  }
  return out;
}

function walk(v: unknown, sink: number[]): void {
  if (typeof v === 'number' && Number.isFinite(v)) sink.push(v);
  else if (typeof v === 'string') extractMetricNumbers(v).forEach((n) => sink.push(n.value));
  else if (Array.isArray(v)) v.forEach((x) => walk(x, sink));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => walk(x, sink));
}

function subsetSums(nums: number[]): number[] {
  const out: number[] = [];
  const n = Math.min(nums.length, 8);
  for (let mask = 1; mask < 1 << n; mask++) { let s = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) s += nums[i]; out.push(s); }
  return out;
}

export function allowedNumbers(ctx: CoachContext): number[] {
  const base: number[] = [];
  walk(ctx, base);
  const set = new Set<number>();
  const add = (n: number) => { set.add(n); set.add(Math.round(n)); set.add(Math.round(n * 10) / 10); if (n >= 0 && n <= 1) { set.add(n * 100); set.add(Math.round(n * 100)); set.add(Math.round(n * 1000) / 10); } };
  base.forEach(add);
  const opp = ctx.opportunities ?? [];
  const lifts = subsetSums(opp.map((o) => o.liftPoints)); const revs = subsetSums(opp.map((o) => o.revenuePerMonth));
  lifts.forEach(add); revs.forEach(add);
  if (ctx.visibility) lifts.forEach((l) => add(ctx.visibility!.score + l));
  if (ctx.revenue) revs.forEach((r) => add(ctx.revenue!.estimatePerMonth + r));
  if (ctx.visibility) { add(ctx.visibility.score - ctx.visibility.previousScore); add(ctx.visibility.answersTested - ctx.visibility.answersMissed); }
  if (ctx.claims) add(ctx.claims.outstanding + ctx.claims.reviewedLast30Days);
  if (ctx.market) { add(ctx.market.nationalShare + ctx.market.peerShare); add(ctx.market.peerShare + ctx.market.shareOfVoice); }
  if (ctx.competitors && ctx.visibility) ctx.competitors.forEach((c) => { add(Math.abs(c.score - ctx.visibility!.score)); if (ctx.market?.scoreIfAllGapsClosed !== undefined) add(Math.abs(c.score - ctx.market.scoreIfAllGapsClosed)); });
  if (ctx.trust) add(ctx.trust.accuracyRate - ctx.trust.accuracyRateStart);
  if (ctx.weeklyScores && ctx.weeklyScores.length > 1) add(ctx.weeklyScores[ctx.weeklyScores.length - 1] - ctx.weeklyScores[0]);
  return Array.from(set);
}

const tol = (v: number) => (v >= 100 ? v * 0.006 : v >= 10 ? 0.5 : 0.06);
const matches = (value: number, allowed: number[]) => allowed.some((a) => Math.abs(a - value) <= tol(Math.max(Math.abs(a), Math.abs(value))));

export function unverifiedIn(text: string, allowed: number[]): string[] {
  return extractMetricNumbers(text).filter((n) => !matches(n.value, allowed)).map((n) => n.raw);
}

export function replyTexts(r: { answer: string; actions: ActionItem[]; sources: CoachSource[] }): string[] {
  return [r.answer, ...r.actions.flatMap((a) => [a.title, a.why, a.expectedImpact, ...a.steps]), ...r.sources.map((s) => `${s.label}: ${s.value}`)];
}

export function verifyReply(r: { answer: string; actions: ActionItem[]; sources: CoachSource[] }, ctx: CoachContext): string[] {
  const allowed = allowedNumbers(ctx);
  return Array.from(new Set(replyTexts(r).flatMap((t) => unverifiedIn(t, allowed))));
}

// ---------- specificity: catches vague advice ----------
export function specificity(r: { answer: string; actions: ActionItem[]; sources: CoachSource[] }, ctx: CoachContext): { entities: string[]; numbers: number } {
  const text = replyTexts(r).join(' ').toLowerCase();
  const names = [...(ctx.assistants ?? []).map((a) => a.name), ...(ctx.competitors ?? []).map((c) => c.name), ...(ctx.visibility?.missReasons ?? []).flatMap((x) => [x.label, x.fix]), ...(ctx.opportunities ?? []).map((o) => o.title)];
  const entities = Array.from(new Set(names.filter((n) => text.includes(n.toLowerCase()))));
  const numbers = new Set(replyTexts(r).flatMap((t) => extractMetricNumbers(t).map((n) => n.value))).size;
  return { entities, numbers };
}
// Advice needs named items and numbers; answers with no actions (out of scope, no data) are exempt.
export function isGeneric(r: { answer: string; actions: ActionItem[]; sources: CoachSource[] }, ctx: CoachContext): boolean {
  if (r.actions.length === 0) return false;
  const s = specificity(r, ctx);
  return s.entities.length < 2 || s.numbers < 3;
}

// ---------- shape validation for model output (never trust the model's JSON) ----------
const strip = (s: string, max: number) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const isStr = (v: unknown, min = 1): v is string => typeof v === 'string' && v.trim().length >= min;

export function validateModelOutput(o: unknown): { ok: true; value: { answer: string; actions: ActionItem[]; sources: CoachSource[] } } | { ok: false; error: string } {
  if (!o || typeof o !== 'object') return { ok: false, error: 'not an object' };
  const r = o as Record<string, unknown>;
  if (!isStr(r.answer)) return { ok: false, error: 'answer missing' };
  if (!Array.isArray(r.actions) || r.actions.length > 3) return { ok: false, error: 'actions invalid' };
  const actions: ActionItem[] = [];
  for (const [i, a] of r.actions.entries()) {
    const x = a as Record<string, unknown>;
    if (!x || !isStr(x.title) || !isStr(x.why) || !isStr(x.expectedImpact) || !isStr(x.metric)) return { ok: false, error: `action ${i + 1} incomplete` };
    if (x.effort !== 'Low' && x.effort !== 'Medium' && x.effort !== 'High') return { ok: false, error: `action ${i + 1} effort invalid` };
    if (!Array.isArray(x.steps) || x.steps.length < 1 || x.steps.length > 4 || !x.steps.every((s) => isStr(s))) return { ok: false, error: `action ${i + 1} steps invalid` };
    const basedOn = Array.isArray(x.basedOn) ? x.basedOn.filter((s): s is string => isStr(s)).slice(0, 5).map((s) => strip(s, 60)) : [];
    actions.push({ id: `act_${i + 1}`, title: strip(x.title, 120), why: strip(x.why, 400), expectedImpact: strip(x.expectedImpact, 200), effort: x.effort, metric: strip(x.metric, 80), steps: (x.steps as string[]).map((s) => strip(s, 200)), basedOn });
  }
  const sources: CoachSource[] = [];
  if (Array.isArray(r.sources)) for (const s of r.sources.slice(0, 6)) { const y = s as Record<string, unknown>; if (y && isStr(y.label) && isStr(y.value)) sources.push({ label: strip(y.label, 60), value: strip(y.value, 60) }); }
  return { ok: true, value: { answer: strip(r.answer as string, 1500), actions, sources } };
}

export function isCoachReply(o: unknown): o is CoachReply {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  return typeof r.answer === 'string' && Array.isArray(r.actions) && Array.isArray(r.sources) && (r.mode === 'live' || r.mode === 'sample' || r.mode === 'fallback') && typeof r.verified === 'boolean';
}
