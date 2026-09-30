'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { buildChart, CHART, type ChartKind } from '../../lib/dashboard/chart';
import type { DashboardViewModel, ListCardData, OpportunityRow, StatCardData, TrustSeries } from '../../lib/dashboard/types';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function useGreeting(): string {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []); // after mount, so server and client HTML match
  if (hour === null) return 'Welcome back';
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function TrendChart({ values, kind, startLabel, endLabel, label }: { values: number[]; kind: ChartKind; startLabel: string; endLabel: string; label: string }) {
  if (values.length < 2) return <p className="cq-chart-empty">Not enough data yet.</p>;
  const g = buildChart(values, kind);
  return (
    <svg className="cq-chart" viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label={label}>
      {g.ticks.map((t) => (
        <g key={t.y}>
          <line className="g" x1={CHART.left} x2={CHART.right} y1={t.y} y2={t.y} />
          <text x={CHART.left - 8} y={t.y + 4} textAnchor="end">{t.label}</text>
        </g>
      ))}
      <text x={CHART.left} y={208}>{startLabel}</text>
      <text x={CHART.right} y={208} textAnchor="end">{endLabel}</text>
      <polygon className="area" points={g.area} />
      <polyline className="line" points={g.line} />
      <circle className="last" cx={g.lastX} cy={g.lastY} r={6} />
    </svg>
  );
}

function Chips<T extends string | number>({ options, value, onChange, format }: { options: T[]; value: T; onChange: (v: T) => void; format: (v: T) => string }) {
  return (
    <div className="cq-chips">
      {options.map((o) => (
        <button key={String(o)} type="button" className="cq-chip" aria-pressed={o === value} onClick={() => onChange(o)}>{format(o)}</button>
      ))}
    </div>
  );
}

function WeeklyCard({ scores }: { scores: number[] }) {
  const options = ([4, 8] as const).filter((n) => scores.length >= n);
  const [weeks, setWeeks] = useState<number>(options.length ? options[options.length - 1] : scores.length);
  const shown = options.length ? scores.slice(-weeks) : scores;
  return (
    <div className="cq-card cq-card-col cq-flex1">
      <div className="cq-chart-head">
        <h2 className="cq-h2">Weekly visibility score</h2>
        {options.length > 1 && <Chips options={[...options]} value={weeks} onChange={setWeeks} format={(n) => `${n} weeks`} />}
      </div>
      <TrendChart values={shown} kind="score" startLabel={`${shown.length} weeks ago`} endLabel="This week"
        label={`Weekly visibility score from ${shown[0]} to ${shown[shown.length - 1]} over ${shown.length} weeks`} />
    </div>
  );
}

function TrustCard({ series, badge }: { series: TrustSeries[]; badge?: string }) {
  const [key, setKey] = useState(series[0]?.key);
  const current = series.find((s) => s.key === key) ?? series[0];
  if (!current) return null;
  const kind: ChartKind = current.kind;
  const values = kind === 'percent' ? current.values.map((v) => v * 100) : current.values;
  const fmt = (v: number) => (kind === 'percent' ? `${Math.round(v)}%` : `${v.toFixed(1)} hours`);
  return (
    <div className="cq-card cq-card-col cq-flex1">
      <div className="cq-chart-head">
        <h2 className="cq-h2">{current.title ?? `${values.length}-day ${current.label.toLowerCase()}`}</h2>
        {badge && <span className="cq-pill is-warn is-badge">{badge}</span>}
      </div>
      {series.length > 1 && <Chips options={series.map((s) => s.key)} value={current.key} onChange={setKey} format={(k) => series.find((s) => s.key === k)?.label ?? k} />}
      <TrendChart values={values} kind={kind} startLabel={`${values.length} days ago`} endLabel="Today"
        label={`${current.label} over ${values.length} days, from ${fmt(values[0])} to ${fmt(values[values.length - 1])}`} />
    </div>
  );
}

function ScoreCard({ value, change }: { value: number; change: number }) {
  const C = 2 * Math.PI * 54;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * C;
  const delta = change > 0 ? `Up ${change} point${change === 1 ? '' : 's'} this week` : change < 0 ? `Down ${Math.abs(change)} point${change === -1 ? '' : 's'} this week` : 'No change this week';
  return (
    <div className="cq-card cq-score">
      <span className="cq-score-label">AI Visibility Score</span>
      <div className="cq-score-body">
        <svg className="cq-ring" viewBox="0 0 140 140" role="img" aria-label={`Score ${value} out of 100`}>
          <circle className="track" cx="70" cy="70" r="54" />
          <circle className="arc" cx="70" cy="70" r="54" strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 70 70)" />
          <text className="num" x="70" y="78" textAnchor="middle">{value}</text>
          <text className="of" x="70" y="98" textAnchor="middle">out of 100</text>
        </svg>
        <div className="cq-score-text">
          <span className={`cq-score-delta${change < 0 ? ' is-bad' : ''}`}>{delta}</span>
          <span className="cq-score-note">How often and how well AI shopping assistants recommend you.</span>
        </div>
      </div>
    </div>
  );
}

function StatInner({ s }: { s: StatCardData }) {
  return (
    <>
      <span className="cq-stat-label">{s.label}</span>
      <div className="cq-stat-line">
        <span className={`cq-stat-value${s.tone === 'bad' ? ' is-bad' : s.tone === 'good' ? ' is-good' : ''}`}>{s.value}</span>
        {s.unit && <span className="cq-stat-unit">{s.unit}</span>}
      </div>
      {(s.pill || s.note) && (
        <div className="cq-stat-foot">
          {s.pill && <span className="cq-pill is-warn">{s.pill}</span>}
          {s.note && <span className="cq-stat-note">{s.note}</span>}
        </div>
      )}
    </>
  );
}

function OpportunityPanel({ rows, links }: { rows: OpportunityRow[]; links?: DashboardViewModel['links'] }) {
  const lift = rows.reduce((a, r) => a + r.liftPoints, 0);
  const money = rows.reduce((a, r) => a + r.revenuePerMonth, 0);
  return (
    <section className="cq-opps" aria-labelledby="cq-opps-title">
      <div className="cq-opps-left">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="cq-opps-eyebrow">Opportunity gaps</span>
          <h2 className="cq-opps-title" id="cq-opps-title">{rows.length} thing{rows.length === 1 ? '' : 's'} to improve now</h2>
          <span className="cq-opps-sub">Together they lift your score by {lift} points, worth about {usd(money)} a month (illustrative estimate).</span>
        </div>
        {(links?.opportunities || links?.simulator) && (
          <div className="cq-opps-btns">
            {links.opportunities && <Link className="cq-oplink is-solid" href={links.opportunities}>See all opportunity gaps</Link>}
            {links.simulator && <Link className="cq-oplink is-outline" href={links.simulator}>Try in the simulator</Link>}
          </div>
        )}
      </div>
      <ol className="cq-opps-rows" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((r, i) => (
          <li key={r.id} className="cq-oprow">
            <span className="cq-opnum">{i + 1}</span>
            <span className="cq-optitle">{r.title}</span>
            <span className="cq-opeffort">{r.effort} effort</span>
            <span className="cq-oplift">+{r.liftPoints} {r.liftPoints === 1 ? 'pt' : 'pts'}</span>
            <span className="cq-oprev">{usd(r.revenuePerMonth)}/mo</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ListCard({ card }: { card: ListCardData }) {
  return (
    <div className="cq-card cq-card-col cq-flex1">
      <h2 className="cq-h2">{card.title}</h2>
      {card.rows.length === 0 && <span className="cq-stat-note">{card.emptyText ?? 'Nothing to show yet.'}</span>}
      {card.rows.map((r, i) => {
        const inner = (<><span className="cq-list-title">{r.title}</span><span className="cq-list-detail">{r.detail}</span></>);
        return r.href ? <Link key={i} className="cq-list-row" href={r.href}>{inner}</Link> : <div key={i} className="cq-list-row">{inner}</div>;
      })}
    </div>
  );
}

export interface DashboardViewProps {
  vm: DashboardViewModel;
  headerRight?: ReactNode;          // existing "Sample data" badge and Reset button go here
  afterStats?: ReactNode;           // e.g. the coach's ActionPlanPanel (prime spot on the front page)
  afterOpportunities?: ReactNode;   // e.g. the Assistant Simulator link card
  afterCharts?: ReactNode;          // e.g. the static Storefront revenue card
}

export default function DashboardView({ vm, headerRight, afterStats, afterOpportunities, afterCharts }: DashboardViewProps) {
  const greeting = useGreeting();
  const hasCharts = (vm.weeklyScores && vm.weeklyScores.length > 1) || (vm.trust && vm.trust.series.length > 0);
  return (
    <>
      <header className="cq-header">
        <div className="cq-header-left">
          <span className="cq-eyebrow">{vm.businessName} · <span className="cq-brand-text">CIRQO Analytics</span></span>
          <h1 className="cq-h1">{greeting}, {vm.firstName}</h1>
        </div>
        <div className="cq-header-right">{headerRight}</div>
      </header>

      {(vm.score || vm.stats.length > 0) && (
        <div className="cq-row cq-row-top">
          {vm.score && <ScoreCard value={vm.score.value} change={vm.score.changeVsLastWeek} />}
          {vm.stats.length > 0 && (
            <div className="cq-stats">
              {vm.stats.map((s) => s.href
                ? <Link key={s.id} className="cq-stat" href={s.href}><StatInner s={s} /></Link>
                : <div key={s.id} className="cq-stat"><StatInner s={s} /></div>)}
            </div>
          )}
        </div>
      )}

      {afterStats}

      {vm.opportunities && vm.opportunities.length > 0 && <OpportunityPanel rows={vm.opportunities} links={vm.links} />}
      {afterOpportunities}

      {hasCharts && (
        <div className="cq-row">
          {vm.weeklyScores && vm.weeklyScores.length > 1 && <WeeklyCard scores={vm.weeklyScores} />}
          {vm.trust && vm.trust.series.length > 0 && <TrustCard series={vm.trust.series} badge={vm.trust.badge} />}
        </div>
      )}
      {afterCharts}

      {vm.lists.length > 0 && <div className="cq-row">{vm.lists.map((c) => <ListCard key={c.id} card={c} />)}</div>}
    </>
  );
}
