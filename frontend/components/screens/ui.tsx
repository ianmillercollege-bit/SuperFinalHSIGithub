'use client';

import type { ReactNode } from 'react';

export type Tone = 'ok' | 'bad' | 'warn' | 'neutral' | 'dark';

export const Pill = ({ tone = 'neutral', large, children }: { tone?: Tone; large?: boolean; children: ReactNode }) => (
  <span className={`cq-pill is-${tone}${large ? ' is-lg' : ''}`}>{children}</span>
);

export function PageHeader({ eyebrow, title, right, claims }: { eyebrow: ReactNode; title: string; right?: ReactNode; claims?: boolean }) {
  return (
    <header className="cq-header">
      <div className="cq-header-left">
        <span className="cq-eyebrow">{claims && <span className="cq-pill is-claims">CLAIMS</span>}{eyebrow}</span>
        <h1 className="cq-h1">{title}</h1>
      </div>
      <div className="cq-header-right">{right}</div>
    </header>
  );
}

export interface StatData { id: string; label: string; value: string; note?: string; color?: string }
export function StatCards({ stats, columns }: { stats: StatData[]; columns: 3 | 4 }) {
  return (
    <div className={columns === 3 ? 'cq-grid3' : 'cq-grid4'}>
      {stats.map((s) => (
        <div key={s.id} className="cq-card cq-card-col" style={{ gap: 6 }}>
          <span className="cq-stat-label">{s.label}</span>
          <span className="cq-stat-value" style={s.color ? { color: s.color } : undefined}>{s.value}</span>
          {s.note && <span className="cq-stat-note">{s.note}</span>}
        </div>
      ))}
    </div>
  );
}

export function ToggleChips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="cq-chips is-pill" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className="cq-chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ id, label, error, help, children }: { id: string; label: string; error?: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="cq-field">
      <label className="cq-label" htmlFor={id}>{label}</label>
      {children}
      {error && <span className="cq-error" id={`${id}-err`} role="alert">{error}</span>}
      {help && <span className="cq-help">{help}</span>}
    </div>
  );
}

export const SampleBadge = () => <span className="cq-badge-sample"><i />Sample data</span>;

export const TitleBlock = ({ title, sub }: { title: string; sub?: ReactNode }) => (
  <div className="cq-title-block"><h2 className="cq-h2">{title}</h2>{sub && <span>{sub}</span>}</div>
);
