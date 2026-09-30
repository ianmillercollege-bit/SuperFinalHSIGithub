'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from './ui';

export interface ChatMessage { id: string; role: 'user' | 'coach'; text: string; sources?: string[] }
export interface CoachViewProps {
  banner: string;                       // "Demo: pre-written answers, not a live AI."
  messages: ChatMessage[];
  suggestions: string[];
  sending?: boolean;
  error?: string;
  onSend: (text: string) => void;
  onClear: () => void;
  onRetry?: () => void;
  headerRight?: ReactNode;
  maxLength?: number;
}

export default function CoachView({ banner, messages, suggestions, sending, error, onSend, onClear, onRetry, headerRight, maxLength = 500 }: CoachViewProps) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages.length, sending]);
  const send = (t: string) => { const v = t.trim(); if (!v || sending) return; onSend(v); setText(''); };
  return (
    <>
      <PageHeader eyebrow="Ask about your dashboard in plain English" title="AI business coach" right={headerRight} />
      <div className="cq-banner" role="note">{banner}</div>
      <div className="cq-row cq-top">
        <div className="cq-card cq-flex3 cq-col">
          <div className="cq-chat" role="log" aria-live="polite" aria-label="Conversation">
            {messages.map((m) => m.role === 'user'
              ? <div key={m.id} className="cq-bubble is-me">{m.text}</div>
              : (
                <div key={m.id} className="cq-bubble is-bot">
                  {m.text}
                  {m.sources && m.sources.length > 0 && (
                    <div><div className="cq-sub" style={{ marginTop: 10, fontWeight: 600 }}>Sources used</div><div className="cq-chips-inline">{m.sources.map((s) => <span key={s} className="cq-source">{s}</span>)}</div></div>
                  )}
                </div>
              ))}
            {sending && <div className="cq-typing">Coach is typing...</div>}
            {error && <div className="cq-note" role="alert" style={{ background: 'var(--cq-bad-bg)', color: 'var(--cq-bad)' }}>{error} {onRetry && <button type="button" className="cq-btn is-quiet" onClick={onRetry}>Retry</button>}</div>}
            <div ref={end} />
          </div>
          <div className="cq-composer">
            <textarea className="cq-textarea" aria-label="Ask a question about your business" placeholder="Ask a question about your business" rows={1} maxLength={maxLength} value={text}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <button type="button" className="cq-btn is-primary" style={{ padding: '0 20px' }} disabled={!text.trim() || sending} onClick={() => send(text)}>Send</button>
          </div>
        </div>
        <div className="cq-card cq-flex1 cq-card-col">
          <h2 className="cq-h2">Suggested questions</h2>
          {suggestions.map((s) => <button key={s} type="button" className="cq-suggest" disabled={sending} onClick={() => send(s)}>{s}</button>)}
          <button type="button" className="cq-btn is-quiet" style={{ alignSelf: 'flex-start' }} onClick={onClear}>Clear chat</button>
        </div>
      </div>
    </>
  );
}
