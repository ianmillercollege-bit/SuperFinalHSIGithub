'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from '../screens/ui';
import type { ChatMessage } from '../screens/CoachView';
import type { ActionItem } from '../../lib/coach/types';

export interface SnapshotItem { label: string; value: string; note?: string }
export interface StarterCard { title: string; question: string }
export interface QuestionGroup { title: string; questions: string[] }
export interface CoachStudioProps {
  live: boolean; banner: string;
  messages: ChatMessage[]; sending: boolean; error?: string;
  snapshot: SnapshotItem[]; dataLabel: string;
  starters: StarterCard[]; groups: QuestionGroup[];
  addedTitles: string[]; onAddToPlan: (a: ActionItem) => void; planHref?: string;
  onSend: (text: string) => void; onRetry: () => void; onRegenerate: () => void; onClear: () => void;
  headerRight?: ReactNode; maxLength?: number;
}

const STATUS = ['Reading your dashboard data', 'Comparing assistants and competitors', 'Weighing impact against effort', 'Drafting your action steps', 'Checking every number'];
const Spark = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" /></svg>;
const Check = () => <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Plane = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 11.5L20 4l-6.5 16-2.7-6.3z" fill="currentColor" /></svg>;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Shows the reply progressively (about 1.5 s). Purely cosmetic: the full text is already here, and screen readers get it at once.
function useReveal(full: string, animate: boolean) {
  const [n, setN] = useState(animate ? 0 : full.length);
  const i = useRef(0);
  useEffect(() => {
    if (!animate) { setN(full.length); return; }
    i.current = 0; let raf = 0; const step = Math.max(2, Math.ceil(full.length / 80));
    const tick = () => { i.current = Math.min(full.length, i.current + step); setN(i.current); if (i.current < full.length) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [full, animate]);
  return { text: full.slice(0, n), done: n >= full.length, skip: () => { i.current = full.length; setN(full.length); } };
}

function Working() {
  const [k, setK] = useState(0);
  useEffect(() => { const t = setInterval(() => setK((v) => Math.min(v + 1, STATUS.length)), 2300); return () => clearInterval(t); }, []);
  return (
    <div className="cq-working cq-rise" role="status" aria-live="polite">
      <div className="row"><span className="cq-dots" aria-hidden="true"><i /><i /><i /></span><span key={k} className="cq-status-line">{k >= STATUS.length ? 'Still working. Longer questions take a little more time.' : `${STATUS[k]}...`}</span></div>
      <div className="cq-skel" style={{ width: '92%' }} /><div className="cq-skel" style={{ width: '68%' }} />
    </div>
  );
}

function CoachMessage({ m, fresh, last, added, onAdd, onRegenerate }: { m: ChatMessage; fresh: boolean; last: boolean; added: string[]; onAdd: (a: ActionItem) => void; onRegenerate: () => void }) {
  const animate = fresh && !reducedMotion();
  const r = useReveal(m.text, animate);
  const [copied, setCopied] = useState(false);
  const showRest = r.done;
  const copy = async () => {
    const body = [m.text, ...(m.actions ?? []).map((a, i) => `${i + 1}. ${a.title} (${a.expectedImpact}). First step: ${a.steps[0]}`)].join('\n');
    try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };
  return (
    <div className={`cq-msg is-coach${fresh ? ' cq-rise' : ''}`}>
      <div className="bub" onClick={() => !r.done && r.skip()} title={r.done ? undefined : 'Click to show the full answer'}>
        <span className="cq-visually-hidden">{m.text}</span>
        <span aria-hidden="true">{r.text}{!r.done && <span className="cq-caret" />}</span>
      </div>
      {showRest && (
        <>
          {m.meta?.mode === 'live' && m.meta.verified && <span className="cq-verified"><Check />AI-generated · numbers checked</span>}
          {m.meta?.mode === 'fallback' && <div className="cq-note is-warn">{m.meta.note ?? 'Built-in answer.'}</div>}
          {m.actions && m.actions.length > 0 && (
            <div className="cq-acts cq-stagger">
              {m.actions.map((a, i) => {
                const isAdded = added.includes(a.title);
                return (
                  <article key={a.id} className="cq-act" style={{ ['--i' as string]: i }}>
                    <div className="cq-act-head"><span className="cq-opnum" style={{ background: 'var(--cq-navy)', color: 'var(--cq-on-navy)' }}>{i + 1}</span><h3>{a.title}</h3><span className="cq-pill is-neutral is-md" style={{ whiteSpace: 'nowrap' }}>{a.effort} effort</span></div>
                    <div className="impact">{a.expectedImpact}</div>
                    <ol>{a.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
                    <div className="cq-act-foot"><span>Improves: {a.metric}</span>
                      <button type="button" className="cq-tool" disabled={isAdded} onClick={() => onAdd(a)} aria-label={isAdded ? `${a.title} is in your plan` : `Add ${a.title} to your plan`}>{isAdded ? <><Check />In your plan</> : '+ Add to my plan'}</button></div>
                  </article>
                );
              })}
            </div>
          )}
          {m.sources && m.sources.length > 0 && <div className="cq-chips-inline">{m.sources.map((s) => <span key={s} className="cq-source">{s}</span>)}</div>}
          {m.id !== 'g' && (
            <div className="cq-msg-tools">
              <button type="button" className="cq-tool" onClick={copy}>{copied ? <><Check />Copied</> : 'Copy'}</button>
              {last && <button type="button" className="cq-tool" onClick={onRegenerate}>Regenerate</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CoachStudio(p: CoachStudioProps) {
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const max = p.maxLength ?? 500;

  // Animate only a reply that arrives because the user just asked something. Restored or cleared chats never replay.
  const sendPhase = useRef(false);
  useEffect(() => {
    if (p.sending) { sendPhase.current = true; return; }
    if (sendPhase.current) {
      const c = [...p.messages].reverse().find((m) => m.role === 'coach' && !known.current?.has(m.id));
      if (c) setFresh(c.id);
      sendPhase.current = false;
    }
    known.current = new Set(p.messages.map((m) => m.id));
  }, [p.sending, p.messages]);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }); }, [p.messages.length, p.sending, p.error]);

  const grow = useCallback(() => { const el = area.current; if (el) { el.style.height = '0px'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; } }, []);
  useEffect(grow, [text, grow]);
  const send = (t: string) => { const v = t.trim(); if (!v || p.sending) return; p.onSend(v); setText(''); };
  const lastCoach = [...p.messages].reverse().find((m) => m.role === 'coach' && m.id !== 'g')?.id;
  const empty = p.messages.length === 1 && p.messages[0].id === 'g';

  return (
    <>
      <PageHeader eyebrow="Ask about your dashboard in plain English" title="AI business coach" right={p.headerRight} />
      <div className={`cq-banner`} role="note">{p.banner}</div>
      <div className="cq-coach">
        <div className="cq-card cq-coach-main">
          <div className="cq-coach-bar">
            <span className="cq-coach-avatar"><Spark /></span>
            <span className="t"><b>CIRQO Coach</b><span>Answers use your dashboard data</span></span>
            <span className={`cq-pill ${p.live ? 'is-ok' : 'is-warn'} is-md`}>{p.live ? 'Live AI' : 'Demo coach'}</span>
            <button type="button" className="cq-tool" onClick={p.onClear}>Clear chat</button>
          </div>
          <div className="cq-scroll" ref={scroller} role="log" aria-label="Conversation">
            {empty ? (
              <div className="cq-rise" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="cq-welcome"><h2>{p.messages[0].text.split('\n')[0]}</h2><p>{p.messages[0].text.split('\n').slice(1).join(' ')} Ask anything about your visibility, competitors, claims or revenue, and I will give you steps you can start this week.</p></div>
                <div className="cq-starters cq-stagger">{p.starters.map((s, i) => (
                  <button key={s.title} type="button" className="cq-starter" style={{ ['--i' as string]: i }} disabled={p.sending} onClick={() => send(s.question)}><b>{s.title}</b><span>{s.question}</span></button>))}</div>
              </div>
            ) : p.messages.map((m, i) => m.role === 'user'
              ? <div key={m.id} className="cq-msg is-user cq-rise"><div className="bub">{m.text}</div></div>
              : <CoachMessage key={m.id} m={m} fresh={fresh === m.id} last={m.id === lastCoach && !p.sending && i === p.messages.length - 1} added={p.addedTitles} onAdd={p.onAddToPlan} onRegenerate={p.onRegenerate} />)}
            {p.sending && <Working />}
            {p.error && <div className="cq-note cq-rise" role="alert" style={{ background: 'var(--cq-bad-bg)', color: 'var(--cq-bad)', alignSelf: 'flex-start' }}>{p.error} <button type="button" className="cq-btn is-quiet" onClick={p.onRetry}>Retry</button></div>}
          </div>
          <div className="cq-composer-wrap">
            <div className="cq-composer2">
              <textarea ref={area} rows={1} aria-label="Ask a question about your business" placeholder="Ask about revenue, missed answers, competitors, claims..." maxLength={max} value={text}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              <button type="button" className="cq-send" aria-label="Send question" disabled={!text.trim() || p.sending} onClick={() => send(text)}><Plane /></button>
            </div>
            <div className="cq-hint"><span>Enter to send · Shift+Enter for a new line</span>{text.length >= max - 50 && <span>{text.length}/{max}</span>}</div>
          </div>
        </div>
        <aside className="cq-coach-side" aria-label="What the coach is looking at">
          <div className="cq-card cq-card-col">
            <div className="cq-chart-head"><h2 className="cq-h2">What I'm looking at</h2><span className="cq-pill is-neutral is-md">{p.dataLabel}</span></div>
            <div className="cq-snap">{p.snapshot.map((s) => <div key={s.label}><span>{s.label}</span><b>{s.value}</b>{s.note && <em>{s.note}</em>}</div>)}</div>
            {p.planHref && <Link className="cq-btn" href={p.planHref}>See my action plan</Link>}
          </div>
          <div className="cq-card cq-card-col" style={{ gap: 14 }}>
            <h2 className="cq-h2">Try asking</h2>
            {p.groups.map((g) => (
              <div key={g.title} className="cq-qgroup"><h3>{g.title}</h3>{g.questions.map((q) => <button key={q} type="button" className="cq-qchip" disabled={p.sending} onClick={() => send(q)}>{q}</button>)}</div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
