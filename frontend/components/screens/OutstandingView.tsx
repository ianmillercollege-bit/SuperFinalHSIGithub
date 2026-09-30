'use client';

import { useState, type ReactNode } from 'react';
import { PageHeader, Pill, StatCards, ToggleChips, type StatData, type Tone } from './ui';

export interface IncidentCardData {
  id: string;
  severity: { label: string; tone: Tone };
  status: { label: string; tone: Tone };     // e.g. Pending approval, Escalated
  meta: string;                              // e.g. "Assistant B · Product X · 2 h ago"
  owner: string;
  title: string;
  aiSaid: string;
  verifiedFact: string;
  rule?: string;
  note?: string;                             // latest update or why there are no buttons
  decidable?: boolean;                       // false: escalate-only items show no Approve/Reject
}
export interface OutstandingViewProps {
  stats: StatData[];
  incidents: IncidentCardData[];
  canDecide: boolean;                        // false for Viewer
  busyId?: string | null;                    // id currently being approved/rejected
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  headerRight?: ReactNode;
}

export default function OutstandingView({ stats, incidents, canDecide, busyId, onApprove, onReject, headerRight }: OutstandingViewProps) {
  const [filter, setFilter] = useState('all');
  const labels = Array.from(new Set(incidents.map((i) => i.status.label)));
  const shown = filter === 'all' ? incidents : incidents.filter((i) => i.status.label === filter);
  return (
    <>
      <PageHeader claims eyebrow="Incidents waiting for a named approver" title="Outstanding claims"
        right={<><span className="cq-count is-red">{incidents.length} outstanding</span>{headerRight}</>} />
      <StatCards stats={stats} columns={3} />
      <ToggleChips value={filter} onChange={setFilter}
        options={[{ value: 'all', label: `All (${incidents.length})` }, ...labels.map((l) => ({ value: l, label: `${l} (${incidents.filter((i) => i.status.label === l).length})` }))]} />
      {shown.length === 0 && (
        <div className="cq-card cq-empty"><span>Nothing waiting for approval.</span></div>
      )}
      <div className="cq-col">
        {shown.map((c) => {
          const busy = busyId === c.id;
          const showButtons = canDecide && c.decidable !== false;
          return (
            <article key={c.id} className="cq-card cq-inc" aria-busy={busy}>
              <div className="cq-inc-head">
                <div className="cq-inc-meta">
                  <span className="cq-inc-id">{c.id}</span>
                  <Pill tone={c.severity.tone} large>{c.severity.label}</Pill>
                  <Pill tone={c.status.tone} large>{c.status.label}</Pill>
                  <span>{c.meta}</span>
                </div>
                <span className="cq-inc-meta">Owner: <b style={{ color: 'var(--cq-text)', fontWeight: 600 }}>{c.owner}</b></span>
              </div>
              <h2 className="cq-h2">{c.title}</h2>
              <div className="cq-grid2">
                <div className="cq-said"><b>What the AI said</b><span>{c.aiSaid}</span></div>
                <div className="cq-fact"><b>Verified fact</b><span>{c.verifiedFact}</span></div>
              </div>
              {c.rule && <div className="cq-line"><b>Rule:</b> {c.rule}</div>}
              {c.note && <div className="cq-line"><b>Latest:</b> {c.note}</div>}
              {showButtons && (
                <div className="cq-actions">
                  <button type="button" className="cq-btn is-orange" disabled={busy} onClick={() => onApprove(c.id)}>{busy ? 'Working...' : 'Approve fix'}</button>
                  <button type="button" className="cq-btn" disabled={busy} onClick={() => onReject(c.id)}>Reject</button>
                </div>
              )}
              {!canDecide && <div className="cq-note is-info">Your role can&apos;t approve or reject items.</div>}
            </article>
          );
        })}
      </div>
    </>
  );
}
