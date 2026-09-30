export interface Lever { id: string; name: string; liftPoints: number }
export interface Assumptions { queries: number; conversionPct: number; orderValue: number }
export const DEFAULT_ASSUMPTIONS: Assumptions = { queries: 14000, conversionPct: 2.5, orderValue: 81.9 };

// Pure math: revenue per visibility point = queries x conversion x order value / 100.
export function simulate(baseline: number, levers: Lever[], pct: Record<string, number>, a: Assumptions) {
  const gain = levers.reduce((s, l) => s + (l.liftPoints * (pct[l.id] ?? 0)) / 100, 0);
  const perPoint = (a.queries * (a.conversionPct / 100) * a.orderValue) / 100;
  return { after: Math.min(100, baseline + gain), gain, revenue: Math.round(gain * perPoint), perPoint };
}
