'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { PageHeader, StatCards, TitleBlock, ToggleChips, type StatData } from './ui';

export type MarketGroup = 'you' | 'peer' | 'national';
export interface MarketRow { id: string; name: string; group: MarketGroup; score: number; averageRank: number; shareOfVoice: number; frequency: number } // rates 0..1
export interface MarketViewProps {
  stats: StatData[];
  rows: MarketRow[];                                            // includes your row
  representation: { national: number; peers: number; you: number };  // 0..1
  landing?: { fromScore: number; toScore: number; rankFrom: number; rankTo: number; rankSmallTo: number; total: number; aheadOf?: string; simulatorHref?: string };
  headerRight?: ReactNode;
}

type SortKey = 'score' | 'averageRank' | 'shareOfVoice' | 'frequency';
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const TYPE: Record<MarketGroup, { label: string; cls: string }> = { you: { label: 'You', cls: 'is-you' }, peer: { label: 'Small business', cls: 'is-peer' }, national: { label: 'National brand', cls: 'is-neutral' } };
const COLOR: Record<MarketGroup, string> = { you: 'var(--cq-navy)', peer: 'var(--cq-peer)', national: 'var(--cq-national)' };
const COLS = '1.9fr 1.3fr 0.7fr 0.8fr 0.95fr 0.85fr';
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const num = (n: number) => WORDS[n] ?? String(n);

export default function MarketView({ stats, rows, representation: rep, landing, headerRight }: MarketViewProps) {
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState<SortKey>('score');
  const filtered = rows.filter((r) => group === 'all' || r.group === 'you' || (group === 'peers' ? r.group === 'peer' : r.group === 'national'));
  const sorted = [...filtered].sort((a, b) => (sort === 'averageRank' ? a.averageRank - b.averageRank : b[sort] - a[sort]));
  const peerCount = rows.filter((r) => r.group === 'peer').length;
  const head = (k: SortKey, label: string) => <button type="button" className="cq-sortbtn" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>;
  return (
    <>
      <PageHeader eyebrow="How you compare with similar small businesses and national brands" title="Market position" right={headerRight} />
      <StatCards stats={stats} columns={3} />
      <div className="cq-row cq-top">
        <div className="cq-card cq-flex3 cq-card-col" style={{ gap: 4 }}>
          <div className="cq-chart-head" style={{ paddingBottom: 12 }}>
            <h2 className="cq-h2">How you compare</h2>
            <ToggleChips value={group} onChange={setGroup} options={[{ value: 'all', label: 'All' }, { value: 'peers', label: 'Small-business peers' }, { value: 'national', label: 'National brands' }]} />
          </div>
          <div className="cq-vhead" style={{ ['--cols' as string]: COLS }}><span>Business</span><span>Type</span>{head('score', 'Score')}{head('averageRank', 'Avg rank')}{head('shareOfVoice', 'Share of voice')}{head('frequency', 'Frequency')}</div>
          {sorted.map((r) => (
            <div key={r.id} className={`cq-vrow${r.group === 'you' ? ' cq-mrow-you' : ''}`} style={{ ['--cols' as string]: COLS, minHeight: 48, cursor: 'default' }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span className={`cq-pill ${TYPE[r.group].cls}`} style={{ justifySelf: 'start', padding: '3px 10px', whiteSpace: 'nowrap' }}>{TYPE[r.group].label}</span>
              <span style={{ fontWeight: 600 }}>{r.score}</span><span>{r.averageRank.toFixed(1)}</span><span>{pct(r.shareOfVoice)}</span><span>{pct(r.frequency)}</span>
            </div>
          ))}
        </div>
        <div className="cq-flex2 cq-col">
          <div className="cq-card cq-card-col" style={{ gap: 14 }}>
            <TitleBlock title="Who AI recommends" sub="Share of all recommendations we tracked" />
            <div className="cq-stack" role="img" aria-label={`National brands ${pct(rep.national)}, small-business peers ${pct(rep.peers)}, you ${pct(rep.you)}`}>
              <div style={{ background: COLOR.national, width: pct(rep.national) }} /><div style={{ background: COLOR.peer, width: pct(rep.peers) }} /><div style={{ background: COLOR.you, width: pct(rep.you) }} />
            </div>
            {([['National brands', rep.national, COLOR.national], ['Small-business peers', rep.peers, COLOR.peer], ['Your business', rep.you, COLOR.you]] as const).map(([l, v, c]) => (
              <div key={l} className="cq-legend"><span><i style={{ background: c }} />{l}</span><b style={{ fontWeight: 600 }}>{pct(v)}</b></div>
            ))}
            <span className="cq-note is-info" style={{ padding: '12px 14px' }}>National brands take {pct(rep.national)} of AI recommendations, your {num(peerCount)} small-business peers share {pct(rep.peers)}, and you get {pct(rep.you)}.</span>
          </div>
          {landing && (
            <div className="cq-navy-card">
              <span className="eyebrow">If you close every gap</span>
              <span className="hl">Score {landing.fromScore} to {landing.toScore}: {ord(landing.rankFrom)} to {ord(landing.rankTo)} of {landing.total}</span>
              <p>Completing all five opportunity gaps would put you {ord(landing.rankSmallTo)} among small businesses{landing.aheadOf ? `, ahead of ${landing.aheadOf}` : ''}. This is an illustrative estimate, not a guarantee.</p>
              {landing.simulatorHref && <Link href={landing.simulatorHref}>Try in the simulator</Link>}
            </div>
          )}
        </div>
      </div>
      <div className="cq-card cq-card-col">
        <div className="cq-chart-head"><h2 className="cq-h2">Visibility score by business</h2><span className="cq-sub">Higher is better. Ranking is never influenced by payment.</span></div>
        {[...rows].sort((a, b) => b.score - a.score).map((r) => (
          <div key={r.id} className="cq-scorebar"><span className={`n${r.group === 'you' ? ' you' : ''}`}>{r.name}</span><span className="t"><div style={{ width: `${r.score}%`, background: COLOR[r.group] }} /></span><span className="v">{r.score}</span></div>
        ))}
      </div>
    </>
  );
}
