'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Field, PageHeader } from './ui';

export interface Lever { id: string; name: string; liftPoints: number }
export interface Assumptions { queries: number; conversionPct: number; orderValue: number }
export const DEFAULT_ASSUMPTIONS: Assumptions = { queries: 14000, conversionPct: 2.5, orderValue: 81.9 };

// Pure math, exported for tests: revenue per visibility point = queries x conversion x order value / 100.
export function simulate(baseline: number, levers: Lever[], pct: Record<string, number>, a: Assumptions) {
  const gain = levers.reduce((s, l) => s + (l.liftPoints * (pct[l.id] ?? 0)) / 100, 0);
  const perPoint = (a.queries * (a.conversionPct / 100) * a.orderValue) / 100;
  return { after: Math.min(100, baseline + gain), gain, revenue: Math.round(gain * perPoint), perPoint };
}

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function GrowthSimulatorView({ baselineScore, levers, initialLever, headerRight }: { baselineScore: number; levers: Lever[]; initialLever?: string; headerRight?: ReactNode }) {
  const zero = useMemo(() => Object.fromEntries(levers.map((l) => [l.id, 0])), [levers]);
  const [pct, setPct] = useState<Record<string, number>>(() => (initialLever && zero[initialLever] !== undefined ? { ...zero, [initialLever]: 100 } : zero));
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [raw, setRaw] = useState({ queries: String(DEFAULT_ASSUMPTIONS.queries), conversionPct: String(DEFAULT_ASSUMPTIONS.conversionPct), orderValue: String(DEFAULT_ASSUMPTIONS.orderValue) });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const r = simulate(baselineScore, levers, pct, a);

  const edit = (k: keyof Assumptions, v: string) => {
    setRaw((x) => ({ ...x, [k]: v }));
    const n = Number(v);
    const bad = v.trim() === '' || !Number.isFinite(n) || n <= 0 || (k === 'conversionPct' && n > 100);
    setErrs((e) => ({ ...e, [k]: bad ? (k === 'conversionPct' ? 'Enter a number from 0 to 100.' : 'Enter a positive number.') : '' }));
    if (!bad) setA((x) => ({ ...x, [k]: n }));
  };
  const restore = () => { setA(DEFAULT_ASSUMPTIONS); setRaw({ queries: String(DEFAULT_ASSUMPTIONS.queries), conversionPct: String(DEFAULT_ASSUMPTIONS.conversionPct), orderValue: String(DEFAULT_ASSUMPTIONS.orderValue) }); setErrs({}); };

  return (
    <>
      <PageHeader eyebrow="Change something and see the effect right away" title="Growth simulator" right={headerRight} />
      <div className="cq-row cq-top">
        <div className="cq-card cq-flex3 cq-card-col" style={{ gap: 18 }}>
          <div className="cq-chart-head">
            <h2 className="cq-h2">What if you did these?</h2>
            <div className="cq-actions">
              <button type="button" className="cq-btn" onClick={() => setPct(zero)}>Reset</button>
              <button type="button" className="cq-btn is-primary" onClick={() => setPct(Object.fromEntries(levers.map((l) => [l.id, 100])))}>Apply all recommended</button>
            </div>
          </div>
          {levers.map((l) => (
            <div key={l.id} className="cq-lever">
              <div className="cq-lever-head"><label htmlFor={`lv-${l.id}`} style={{ fontWeight: 600 }}>{l.name}</label><span className="cq-muted">+{l.liftPoints} {l.liftPoints === 1 ? 'point' : 'points'} · {pct[l.id]}% done</span></div>
              <input id={`lv-${l.id}`} className="cq-range" type="range" min={0} max={100} step={5} value={pct[l.id]}
                style={{ ['--pct' as string]: `${pct[l.id]}%` }} aria-valuetext={`${pct[l.id]} percent implemented`}
                onChange={(e) => setPct((x) => ({ ...x, [l.id]: Number(e.target.value) }))} />
            </div>
          ))}
        </div>
        <div className="cq-flex2 cq-col">
          <div className="cq-card cq-card-col" style={{ gap: 16, padding: 24 }} aria-live="polite">
            <div><span className="cq-score-label">Visibility score</span><div className="cq-hero" style={{ fontSize: 44 }}>{baselineScore} <span style={{ color: '#7C8BA1' }}>→</span> {Math.round(r.after * 10) / 10}</div></div>
            <div><span className="cq-score-label">Projected revenue</span><div className="cq-hero" style={{ fontSize: 36, color: 'var(--cq-ok)' }}>+{usd(r.revenue)}<span style={{ fontFamily: 'var(--cq-font-ui)', fontSize: 14, fontWeight: 400, color: 'var(--cq-text-muted)' }}> /month</span></div></div>
            {[['Now', baselineScore, '#7C8BA1'], ['After', r.after, 'var(--cq-navy)']].map(([t, v, c]) => (
              <div key={String(t)} className="cq-inc-meta"><span style={{ width: 52 }}>{t}</span><div className="cq-bar"><div style={{ width: `${v}%`, background: String(c) }} /></div></div>
            ))}
            <span className="cq-pill is-warn" style={{ alignSelf: 'flex-start' }}>Illustrative estimate, not a guarantee</span>
          </div>
          <div className="cq-card cq-card-col" style={{ gap: 10 }}>
            <h2 className="cq-h2">Assumptions</h2>
            {([['queries', 'AI-driven shopper questions per month'], ['conversionPct', 'Conversion rate (%)'], ['orderValue', 'Average order value ($)']] as const).map(([k, label]) => (
              <Field key={k} id={`as-${k}`} label={label} error={errs[k]}>
                <input id={`as-${k}`} className="cq-input" inputMode="decimal" value={raw[k]} aria-invalid={!!errs[k]} onChange={(e) => edit(k, e.target.value)} />
              </Field>
            ))}
            <button type="button" className="cq-btn" style={{ alignSelf: 'flex-start' }} onClick={restore}>Restore defaults</button>
          </div>
        </div>
      </div>
    </>
  );
}
