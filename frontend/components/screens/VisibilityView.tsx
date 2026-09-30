'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { PageHeader, StatCards, TitleBlock, type StatData } from './ui';

export interface PromptCell { assistant: string; rank: number | null; reason?: string }
export interface PromptRow { id: string; text: string; category: string; cells: PromptCell[]; detail?: string }
export interface ReasonGroup { key: string; label: string; count: number; opportunityTitle: string; opportunityHref?: string }
export interface VisibilityViewProps {
  stats: StatData[];
  assistants: string[];
  prompts: PromptRow[];
  reasons: ReasonGroup[];
  missedTotal: number;
  claimHref?: (assistant: string, promptId: string) => string;   // e.g. /claims/new?assistant=..&question=..
  defaultSelectedId?: string;
  headerRight?: ReactNode;
}

const short = (a: string) => a.replace('Assistant ', '');
const cellText = (c: PromptCell) => (c.rank === null ? 'Not shown' : `Rank ${c.rank}`);

export default function VisibilityView({ stats, assistants, prompts, reasons, missedTotal, claimHref, defaultSelectedId, headerRight }: VisibilityViewProps) {
  const [assistant, setAssistant] = useState('all');
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const firstMissed = prompts.find((p) => p.cells.some((c) => c.rank === null))?.id ?? prompts[0]?.id;
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultSelectedId ?? firstMissed);

  const cols = assistant === 'all' ? assistants : [assistant];
  const shown = useMemo(() => prompts.filter((p) => {
    const cells = p.cells.filter((c) => cols.includes(c.assistant));
    if (onlyMissed && !cells.some((c) => c.rank === null)) return false;
    if (reason && !p.cells.some((c) => c.reason === reason)) return false;
    return !query.trim() || p.text.toLowerCase().includes(query.trim().toLowerCase());
  }), [prompts, cols, onlyMissed, reason, query]);
  const selected = prompts.find((p) => p.id === selectedId);
  const gridCols = `2.6fr 0.9fr repeat(${cols.length}, 0.9fr)`;

  const why = (p: PromptRow): string => {
    if (p.detail) return p.detail;
    const missed = p.cells.filter((c) => c.rank === null);
    if (missed.length === 0) return 'Every assistant recommended you for this question.';
    const byReason = new Map<string, string[]>();
    missed.forEach((c) => { const k = reasons.find((r) => r.key === c.reason)?.label ?? 'No reason recorded'; byReason.set(k, [...(byReason.get(k) ?? []), c.assistant]); });
    return Array.from(byReason.entries()).map(([label, who]) => `${who.join(', ')}: ${label}.`).join(' ');
  };
  const selectedReasons = selected ? Array.from(new Set(selected.cells.map((c) => c.reason).filter(Boolean))) as string[] : [];

  return (
    <>
      <PageHeader eyebrow="Which shopper questions mention your business, and why not the others" title="AI visibility" right={headerRight} />
      <StatCards stats={stats} columns={4} />
      <div className="cq-toolbar">
        {['all', ...assistants].map((a) => (
          <button key={a} type="button" className="cq-chip is-pill" aria-pressed={assistant === a} onClick={() => setAssistant(a)}>{a === 'all' ? 'All assistants' : a}</button>
        ))}
        <button type="button" className="cq-chip is-pill" style={{ marginLeft: 12 }} aria-pressed={onlyMissed} onClick={() => setOnlyMissed(!onlyMissed)}>Only missed prompts</button>
        <input className="cq-input cq-search" type="search" aria-label="Search prompts" placeholder="Search prompts" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="cq-row cq-top">
        <div className="cq-card cq-flex3 cq-card-col" style={{ gap: 2 }}>
          <div className="cq-chart-head" style={{ paddingBottom: 12 }}><h2 className="cq-h2">Shopper questions we tested</h2><span className="cq-sub">Rank = position in the assistant&apos;s answer</span></div>
          <div className="cq-vhead" style={{ ['--cols' as string]: gridCols }}><span>Question</span><span>Type</span>{cols.map((a) => <span key={a}>{short(a)}</span>)}</div>
          {shown.length === 0 && <div className="cq-empty">No questions match these filters.</div>}
          {shown.map((p) => (
            <button key={p.id} type="button" className="cq-vrow" aria-pressed={p.id === selectedId} style={{ ['--cols' as string]: gridCols }} onClick={() => setSelectedId(p.id)}>
              <span className="cq-vq">{p.text}</span><span className="cq-sub">{p.category}</span>
              {p.cells.filter((c) => cols.includes(c.assistant)).map((c) => (
                <span key={c.assistant} className={`cq-pill is-${c.rank === null ? 'neutral' : 'ok'} is-md`} style={{ justifySelf: 'start', whiteSpace: 'nowrap' }}>{cellText(c)}</span>
              ))}
            </button>
          ))}
        </div>
        <div className="cq-flex1 cq-col">
          <div className="cq-card cq-card-col" style={{ gap: 14 }}>
            <TitleBlock title="Why we're missing" sub={`${missedTotal} answers did not mention you`} />
            {reasons.map((r) => (
              <div key={r.key} className="cq-reason">
                <button type="button" className="cq-reason-btn" aria-pressed={reason === r.key} onClick={() => setReason(reason === r.key ? null : r.key)}>
                  <span className="cq-reason-line"><b>{r.label}</b><span>{r.count} answers</span></span>
                  <span className="cq-meter"><div style={{ width: `${Math.round((r.count / Math.max(1, missedTotal)) * 100)}%` }} /></span>
                </button>
                {r.opportunityHref && <Link href={r.opportunityHref}>Fix it: {r.opportunityTitle}</Link>}
              </div>
            ))}
          </div>
          {selected && (
            <div className="cq-card cq-card-col" aria-live="polite">
              <span className="cq-sub" style={{ fontWeight: 600 }}>Selected question</span>
              <h2 className="cq-h2" style={{ lineHeight: 1.3 }}>{selected.text}</h2>
              <div className="cq-grid2" style={{ gap: 8 }}>
                {selected.cells.map((c) => (
                  <div key={c.assistant} className={`cq-cell is-${c.rank === null ? 'neutral' : 'ok'}`}><b>{c.assistant}</b><span>{c.rank === null ? 'Not shown' : `Recommended, rank ${c.rank}`}</span></div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: 'var(--cq-text-body)', lineHeight: 1.5 }}><b style={{ fontWeight: 600 }}>Why:</b> {why(selected)}</span>
              <div className="cq-actions" style={{ gap: 8 }}>
                {selectedReasons.map((k) => { const g = reasons.find((r) => r.key === k); return g?.opportunityHref ? <Link key={k} className="cq-btn is-primary" style={{ fontSize: 13 }} href={g.opportunityHref}>See the opportunity</Link> : null; })}
                {claimHref && <Link className="cq-btn is-orange" style={{ fontSize: 13 }} href={claimHref(selected.cells.find((c) => c.rank === null)?.assistant ?? assistants[0], selected.id)}>File a claim</Link>}
              </div>
              <span className="cq-sub" style={{ lineHeight: 1.45 }}>Think an assistant said something wrong? File a claim and a CIRQO reviewer will check it.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
