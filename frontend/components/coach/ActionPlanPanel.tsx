'use client';

import Link from 'next/link';
import type { ActionPlan } from '../../lib/coach/useActionPlan';

export interface ActionPlanPanelProps {
  plan: ActionPlan;
  checks: Record<string, boolean>;
  onToggle: (key: string) => void;
  onRefresh?: () => void;          // omit when the AI coach is not available (sample mode)
  refreshing?: boolean;
  error?: string;
  askHref?: string;                // link to the coach page
}

const stepKey = (title: string, i: number) => `${title}#${i}`;
const time = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };

export default function ActionPlanPanel({ plan, checks, onToggle, onRefresh, refreshing, error, askHref }: ActionPlanPanelProps) {
  const total = plan.actions.reduce((n, a) => n + a.steps.length, 0);
  const done = plan.actions.reduce((n, a) => n + a.steps.filter((_, i) => checks[stepKey(a.title, i)]).length, 0);
  const badge = plan.mode === 'live' && plan.verified ? { cls: 'is-ok', text: 'AI-generated · numbers checked' } : plan.mode === 'fallback' ? { cls: 'is-warn', text: 'Built-in plan · AI unavailable' } : { cls: 'is-neutral', text: 'Built-in plan from your data' };
  return (
    <section className="cq-card cq-plan" aria-labelledby="cq-plan-title">
      <div className="cq-plan-head">
        <div className="cq-title-block">
          <h2 className="cq-h2" id="cq-plan-title">Your action plan</h2>
          <span>Prioritized by impact and effort, from your dashboard data</span>
        </div>
        <div className="cq-plan-tools">
          <span className={`cq-pill ${badge.cls} is-md`}>{badge.text}</span>
          {onRefresh && <button type="button" className="cq-btn" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Updating...' : 'Refresh with AI'}</button>}
          {askHref && <Link className="cq-btn is-primary" href={askHref}>Ask the coach</Link>}
        </div>
      </div>
      {plan.note && <div className="cq-note is-warn" role="status">{plan.note}</div>}
      {error && <div className="cq-note" role="alert" style={{ background: 'var(--cq-bad-bg)', color: 'var(--cq-bad)' }}>{error}</div>}
      <div className="cq-plan-progress" aria-live="polite">
        <div className="cq-bar"><div style={{ width: total ? `${(done / total) * 100}%` : '0%', background: 'var(--cq-navy)' }} /></div>
        <span>{done} of {total} steps done{plan.generatedAt ? ` · updated ${time(plan.generatedAt)}` : ''}</span>
      </div>
      {plan.actions.length === 0 && <div className="cq-empty">No actions yet. Ask the coach a question to get a plan.</div>}
      {/* 3, 5, 6 or 8 actions fill three columns; 2, 4 or 7 use two, so no card sits alone beside an empty gap */}
      <div className="cq-plan-grid" style={{ ['--cols' as string]: plan.actions.length === 2 || plan.actions.length % 3 === 1 ? 2 : 3 }}>
        {plan.actions.map((a, n) => (
          <article key={a.id} className="cq-action">
            <div className="cq-action-head">
              <span className="cq-opnum" style={{ background: 'var(--cq-navy)', color: 'var(--cq-on-navy)' }}>{n + 1}</span>
              <h3>{a.title}</h3>
              <span className="cq-pill is-neutral is-md" style={{ whiteSpace: 'nowrap' }}>{a.effort} effort</span>
            </div>
            <div className="cq-action-impact"><span>Expected impact</span><b>{a.expectedImpact}</b></div>
            <p className="cq-line">{a.why}</p>
            <fieldset className="cq-fieldset">
              <legend className="cq-visually-hidden">Steps for {a.title}</legend>
              {a.steps.map((s, i) => (
                <label key={i} className="cq-check" style={{ alignItems: 'flex-start', minHeight: 32 }}>
                  <input type="checkbox" checked={!!checks[stepKey(a.title, i)]} onChange={() => onToggle(stepKey(a.title, i))} />
                  <span style={checks[stepKey(a.title, i)] ? { textDecoration: 'line-through', color: 'var(--cq-text-muted)' } : undefined}>{s}</span>
                </label>
              ))}
            </fieldset>
            <span className="cq-sub">Improves: {a.metric}{a.basedOn.length ? ` · Based on: ${a.basedOn.join(', ')}` : ''}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
