'use client';

import Dropdown from '@/components/Dropdown';
import { useState, type ReactNode } from 'react';
import { PageHeader, Pill, StatCards, TitleBlock, ToggleChips, type StatData, type Tone } from './ui';

export interface ReviewedRow { id: string; title: string; type: string; outcome: { label: string; tone: Tone }; detail: string; by: string; date: string }
export interface InsightRow { who: string; what: string }
export interface ReviewedViewProps { stats: StatData[]; rows: ReviewedRow[]; insights: InsightRow[]; pageSize?: number; headerRight?: ReactNode }

const COLS = '84px 1.2fr 1.1fr 1.6fr 1.2fr';

export default function ReviewedView({ stats, rows, insights, pageSize = 5, headerRight }: ReviewedViewProps) {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [actor, setActor] = useState('all');
  const labels = Array.from(new Set(rows.map((r) => r.outcome.label)));
  const shown = filter === 'all' ? rows : rows.filter((r) => r.outcome.label === filter);
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const slice = shown.slice(page * pageSize, page * pageSize + pageSize);
  const actors = Array.from(new Set(insights.map((i) => i.who.split(' · ')[0])));
  const feed = actor === 'all' ? insights : insights.filter((i) => i.who.split(' · ')[0] === actor);
  return (
    <>
      <PageHeader claims eyebrow="Resolved incidents and the actions behind them" title="Claims reviewed"
        right={<><span className="cq-count is-green">{rows.length} reviewed</span>{headerRight}</>} />
      <StatCards stats={stats} columns={3} />
      <div className="cq-row cq-top">
        <div className="cq-card cq-flex3 cq-card-col" style={{ gap: 4 }}>
          <div className="cq-chart-head" style={{ paddingBottom: 12 }}>
            <h2 className="cq-h2">Reviewed claims</h2>
            <ToggleChips value={filter} onChange={(v) => { setFilter(v); setPage(0); }} options={[{ value: 'all', label: 'All' }, ...labels.map((l) => ({ value: l, label: l }))]} />
          </div>
          <div className="cq-th" style={{ ['--cols' as string]: COLS }}><span>Claim</span><span>Item</span><span>Outcome</span><span>What happened</span><span>Reviewed by</span></div>
          {slice.length === 0 && <div className="cq-empty">No reviewed claims match this filter.</div>}
          {slice.map((r) => (
            <div key={r.id} className="cq-tr" style={{ ['--cols' as string]: COLS }}>
              <span className="id">{r.id}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontWeight: 600 }}>{r.title}</b><span className="cq-sub">{r.type}</span></div>
              <span style={{ justifySelf: 'start' }}><Pill tone={r.outcome.tone} large>{r.outcome.label}</Pill></span>
              <span style={{ color: 'var(--cq-text-body)', lineHeight: 1.45 }}>{r.detail}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 500 }}>{r.by}</span><span className="cq-sub">{r.date}</span></div>
            </div>
          ))}
          <div className="cq-chart-head" style={{ paddingTop: 12 }}>
            <span className="cq-sub">Showing {slice.length} of {shown.length}</span>
            {pages > 1 && (
              <div className="cq-actions">
                <button type="button" className="cq-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <button type="button" className="cq-btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </div>
        </div>
        <div className="cq-card cq-flex1 cq-card-col">
          <TitleBlock title="Insights" sub="Every action, by a named person or the system" />
          <Dropdown label="Filter by actor" hideLabel value={actor} onChange={setActor} options={[{ value: 'all', label: 'All actors' }, ...actors.map((a) => ({ value: a, label: a }))]} />
          {feed.map((i, k) => (
            <div key={k} className="cq-list-row"><span className="cq-sub">{i.who}</span><span style={{ fontSize: 14, lineHeight: 1.4 }}>{i.what}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}
