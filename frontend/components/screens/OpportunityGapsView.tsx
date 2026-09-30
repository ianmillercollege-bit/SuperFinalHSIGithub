'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from './ui';

export interface OpportunityDetail { id: string; title: string; effort: string; why: string; liftPoints: number; revenuePerMonth: number; step: string }
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function OpportunityGapsView({ items, planned, onTogglePlanned, simulatorHref, headerRight }: { items: OpportunityDetail[]; planned: string[]; onTogglePlanned: (id: string) => void; simulatorHref?: string; headerRight?: ReactNode }) {
  const lift = items.reduce((a, i) => a + i.liftPoints, 0), money = items.reduce((a, i) => a + i.revenuePerMonth, 0);
  return (
    <>
      <PageHeader eyebrow={`${items.length} specific things you can improve. Together: +${lift} points, about +${usd(money)}/month (illustrative estimate).`} title="Opportunity gaps" right={headerRight} />
      <div className="cq-grid2">
        {items.map((o) => (
          <article key={o.id} id={o.id} className="cq-card cq-card-col" style={{ gap: 12 }}>
            <div className="cq-chart-head" style={{ alignItems: 'flex-start' }}><h2 className="cq-h2">{o.title}</h2><span className="cq-pill is-neutral is-lg">{o.effort} effort</span></div>
            <span className="cq-line">{o.why}</span>
            <div className="cq-opp-vals">
              <div><span className="lab">Visibility</span><span className="val" style={{ color: 'var(--cq-ok)' }}>+{o.liftPoints} {o.liftPoints === 1 ? 'point' : 'points'}</span></div>
              <div><span className="lab">Estimated revenue</span><span className="val">{usd(o.revenuePerMonth)}<span style={{ fontFamily: 'var(--cq-font-ui)', fontSize: 12, fontWeight: 400, color: 'var(--cq-text-muted)' }}> /month</span></span></div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--cq-text-body)' }}><b style={{ fontWeight: 600 }}>First step:</b> {o.step}</span>
            <div className="cq-actions">
              <button type="button" className="cq-btn" aria-pressed={planned.includes(o.id)} onClick={() => onTogglePlanned(o.id)}>{planned.includes(o.id) ? 'Planned ✓' : 'Mark as planned'}</button>
              {simulatorHref && <Link className="cq-btn is-primary" href={`${simulatorHref}?lever=${o.id}`}>Try in simulator</Link>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
