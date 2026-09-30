'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from './ui';

export interface Opt { value: string; label: string }
export interface SimFact { text: string; status: 'checked' | 'failed' | 'removed'; detail?: string }
export interface SimTurn {
  id: string; question: string; assistant: string; constraints: string[]; pending?: boolean; error?: string;
  answer?: { text: string; facts: SimFact[]; matched?: string[]; unmet?: string[]; noMatchMessage?: string; source?: string;
    options?: { name: string; detail?: string; verified: boolean }[] };   // added locally (contract v1.5): each option says whether the brand verified it
}
export interface SimulatorSend { question: string; assistant: string; useCase: string; mustHave: string[] }
export interface AssistantSimulatorViewProps {
  defaultQuestion: string; maxLength?: number;
  assistants: Opt[]; useCases: Opt[]; mustHaves: Opt[]; defaultUseCase?: string;
  turns: SimTurn[]; sending?: boolean;
  onSend: (v: SimulatorSend) => void; onClear: () => void; onRetry?: (turnId: string) => void;
  headerRight?: ReactNode;
  title?: string; eyebrow?: string;   // added locally: the page is named "Preview as shopper" (DECISIONS.md #32)
  intro?: ReactNode;                  // added locally: a short note under the header
}

const CheckIcon = () => <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const FACT = { checked: { tone: 'ok', label: 'Checked' }, failed: { tone: 'bad', label: 'Not verified' }, removed: { tone: 'warn', label: 'Removed' } } as const;

export default function AssistantSimulatorView({ defaultQuestion, maxLength = 500, assistants, useCases, mustHaves, defaultUseCase, turns, sending, onSend, onClear, onRetry, headerRight, title = 'Assistant simulator', eyebrow = 'See what an AI assistant would say, verified', intro }: AssistantSimulatorViewProps) {
  const initUse = defaultUseCase ?? useCases[0]?.value ?? '';
  const [question, setQuestion] = useState(defaultQuestion);
  const [assistant, setAssistant] = useState(assistants[0]?.value ?? '');
  const [useCase, setUseCase] = useState(initUse);
  const [must, setMust] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [turns.length, sending]);
  const send = () => { const q = question.trim(); if (!q || sending) return; onSend({ question: q, assistant, useCase, mustHave: must }); };
  const reset = () => { setQuestion(defaultQuestion); setUseCase(initUse); setMust([]); };

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} right={headerRight} />
      {intro}
      <div className="cq-row cq-top">
        <div className="cq-card cq-flex3 cq-col">
          <div className="cq-chat" role="log" aria-live="polite" aria-label="Simulator conversation">
            {turns.length === 0 && <div className="cq-bubble is-bot">Ask a shopper question, choose an assistant and constraints, then press Send. The answer comes from the CIRQO connector, and every fact is checked.</div>}
            {turns.map((t) => (
              <div key={t.id} className="cq-col" style={{ gap: 12 }}>
                <div className="cq-bubble is-me">
                  {t.question}
                  <div className="cq-chips-inline"><span className="cq-me-chip">{t.assistant}</span>{t.constraints.map((c) => <span key={c} className="cq-me-chip">{c}</span>)}</div>
                </div>
                {t.pending && <div className="cq-typing">Checking facts...</div>}
                {t.error && <div className="cq-note" role="alert" style={{ background: 'var(--cq-bad-bg)', color: 'var(--cq-bad)', alignSelf: 'flex-start' }}>{t.error} {onRetry && <button type="button" className="cq-btn is-quiet" onClick={() => onRetry(t.id)}>Retry</button>}</div>}
                {t.answer && (
                  <div className="cq-bot-wrap">
                    <div className="cq-bubble is-bot">{t.answer.text}</div>
                    {t.answer.noMatchMessage && <div className="cq-note is-warn">{t.answer.noMatchMessage} No verified product matches these constraints. Try removing one.</div>}
                    {t.answer.options && t.answer.options.length > 0 && (
                      <div className="cq-facts">
                        <span className="cq-sub" style={{ fontWeight: 600 }}>Options returned</span>
                        {t.answer.options.map((o, i) => (
                          <div key={i} className="cq-fact-row">
                            <span>{o.name}{o.detail && <span className="cq-sub"> · {o.detail}</span>}</span>
                            <span className={`cq-pill is-${o.verified ? 'ok' : 'warn'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>{o.verified && <CheckIcon />}{o.verified ? 'Verified by brand' : 'Not verified by the brand'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.answer.facts.length > 0 && (
                      <div className="cq-facts">
                        <span className="cq-sub" style={{ fontWeight: 600 }}>Facts in this answer</span>
                        {t.answer.facts.map((f, i) => (
                          <div key={i} className="cq-fact-row">
                            <span>{f.text}{f.detail && <span className="cq-sub"> · {f.detail}</span>}</span>
                            <span className={`cq-pill is-${FACT[f.status].tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>{f.status === 'checked' && <CheckIcon />}{FACT[f.status].label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(t.answer.matched?.length || t.answer.unmet?.length) ? (
                      <div className="cq-sub">{t.answer.matched?.length ? `Matched: ${t.answer.matched.join(', ')}` : ''}{t.answer.matched?.length && t.answer.unmet?.length ? ' · ' : ''}{t.answer.unmet?.length ? `Not met: ${t.answer.unmet.join(', ')}` : ''}</div>
                    ) : null}
                    {t.answer.source && <span className="cq-sub">Source: {t.answer.source}</span>}
                  </div>
                )}
              </div>
            ))}
            {turns.length > 0 && <span className="cq-sub">Your question and constraints went through the CIRQO connector, and every fact was checked against verified product data.</span>}
            <div ref={end} />
          </div>
          <div className="cq-composer">
            <textarea className="cq-textarea" aria-label="Shopper question" rows={1} maxLength={maxLength} value={question}
              onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="cq-btn is-primary" style={{ padding: '0 20px' }} disabled={!question.trim() || sending} onClick={send}>{sending ? 'Sending...' : 'Send'}</button>
          </div>
        </div>
        <div className="cq-card cq-flex1 cq-card-col">
          <h2 className="cq-h2">Constraints</h2>
          <div className="cq-field"><label className="cq-label" htmlFor="sim-assistant">Assistant</label>
            <select id="sim-assistant" className="cq-select" value={assistant} onChange={(e) => setAssistant(e.target.value)}>{assistants.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
          <div className="cq-field"><label className="cq-label" htmlFor="sim-use">Use case</label>
            <select id="sim-use" className="cq-select" value={useCase} onChange={(e) => setUseCase(e.target.value)}>{useCases.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
          <fieldset className="cq-fieldset"><legend className="cq-label" style={{ marginBottom: 4 }}>Must have</legend>
            {mustHaves.map((m) => (
              <label key={m.value} className="cq-check"><input type="checkbox" checked={must.includes(m.value)} onChange={(e) => setMust((x) => (e.target.checked ? [...x, m.value] : x.filter((y) => y !== m.value)))} />{m.label}</label>
            ))}
          </fieldset>
          <div className="cq-actions"><button type="button" className="cq-btn is-quiet" onClick={reset}>Reset</button><button type="button" className="cq-btn is-quiet" onClick={onClear}>Clear chat</button></div>
        </div>
      </div>
    </>
  );
}
