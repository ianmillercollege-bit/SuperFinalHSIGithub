export const CHART = { w: 520, h: 220, left: 40, right: 508, top: 12, bottom: 184 } as const;
export type ChartKind = 'score' | 'percent' | 'hours';

export interface ChartGeometry {
  line: string; area: string; lastX: number; lastY: number;
  ticks: { y: number; label: string }[];
}

// Domain with headroom: score/percent use steps of 10 within 0..100, hours use steps of 2.
export function domainFor(values: number[], kind: ChartKind): { lo: number; hi: number; step: number } {
  const min = Math.min(...values), max = Math.max(...values);
  if (kind === 'hours') {
    const lo = Math.max(0, Math.floor((min - 1) / 2) * 2);
    let hi = Math.ceil((max + 1) / 2) * 2;
    if (hi <= lo) hi = lo + 2;
    return { lo, hi, step: 2 };
  }
  const lo = Math.max(0, Math.floor((min - 5) / 10) * 10);
  let hi = Math.min(100, Math.ceil((max + 10) / 10) * 10);
  if (hi <= lo) hi = Math.min(100, lo + 10);
  return { lo, hi, step: 10 };
}

export function tickLabel(v: number, kind: ChartKind): string {
  return kind === 'percent' ? `${v}%` : kind === 'hours' ? `${v}h` : String(v);
}

// values are already in display units (percent series must be multiplied by 100 before calling).
export function buildChart(values: number[], kind: ChartKind): ChartGeometry {
  const { lo, hi, step } = domainFor(values, kind);
  const n = values.length;
  const x = (i: number) => (n === 1 ? (CHART.left + CHART.right) / 2 : CHART.left + ((CHART.right - CHART.left) * i) / (n - 1));
  const y = (v: number) => CHART.top + (CHART.bottom - CHART.top) * (1 - (v - lo) / (hi - lo));
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = pts.join(' ');
  const area = `${line} ${x(n - 1).toFixed(1)},${CHART.bottom} ${x(0).toFixed(1)},${CHART.bottom}`;
  const ticks: { y: number; label: string }[] = [];
  for (let v = hi; v >= lo; v -= step) ticks.push({ y: y(v), label: tickLabel(v, kind) });
  return { line, area, lastX: x(n - 1), lastY: y(values[n - 1]), ticks };
}
