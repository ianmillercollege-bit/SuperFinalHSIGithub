'use client';

import Dropdown from '@/components/Dropdown';
import { useState, type ReactNode } from 'react';
import { Field, PageHeader, Pill, ToggleChips, type Tone } from './ui';

// Build `fields` from the contract's checker/run request fields only; add none.
export interface FieldSpec {
  name: string; label: string; type: 'text' | 'textarea' | 'select' | 'chips';
  options?: string[]; required?: boolean; maxLength?: number; minLength?: number; placeholder?: string; defaultValue?: string; half?: boolean;
}
export type Verdict = 'correct' | 'incorrect' | 'outdated' | 'unverifiable';
export interface CheckerResultData {
  claims: { text: string; verdict: Verdict; fact?: string }[];
  incident?: { id: string; severity: string; state: string; href: string };
  sourceLabel?: string;
}
export interface CheckerViewProps {
  fields: FieldSpec[];
  onSubmit: (values: Record<string, string>) => void;
  submitting?: boolean;
  disabled?: boolean; disabledNote?: string;
  error?: string;
  result?: CheckerResultData;
  onReset?: () => void;
  steps?: { title: string; body: string }[];
  notice?: string;
  headerRight?: ReactNode;
  renderLink?: (href: string, label: string) => ReactNode;   // pass a next/link wrapper
}

const TONE: Record<Verdict, Tone> = { correct: 'ok', incorrect: 'bad', outdated: 'warn', unverifiable: 'neutral' };
const LABEL: Record<Verdict, string> = { correct: 'Correct', incorrect: 'Incorrect', outdated: 'Outdated', unverifiable: 'Unverifiable' };

export default function CheckerView({ fields, onSubmit, submitting, disabled, disabledNote, error, result, onReset, steps, notice, headerRight, renderLink }: CheckerViewProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'chips' || f.type === 'select' ? f.options?.[0] ?? '' : '')])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (n: string, v: string) => setValues((x) => ({ ...x, [n]: v }));

  const check = (f: FieldSpec, v: string): string => {
    const t = v.trim();
    if (f.required && !t) return 'This field is required.';
    if (f.minLength && t.length < f.minLength) return `Use at least ${f.minLength} characters.`;
    if (f.maxLength && t.length > f.maxLength) return `Use at most ${f.maxLength} characters.`;
    return '';
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    fields.forEach((f) => { const m = check(f, values[f.name] ?? ''); if (m) next[f.name] = m; });
    setErrors(next);
    const first = fields.find((f) => next[f.name]);
    if (first) { document.getElementById(`f-${first.name}`)?.focus(); return; }
    onSubmit(Object.fromEntries(fields.map((f) => [f.name, (values[f.name] ?? '').trim()])));
  };
  const half = (f: FieldSpec) => !!f.half;

  return (
    <>
      <PageHeader claims eyebrow="Run a check on something an AI assistant said" title="File a claim" right={headerRight} />
      <div className="cq-row cq-top">
        <form className="cq-card cq-flex3 cq-col" style={{ gap: 18 }} onSubmit={submit} noValidate>
          {notice && <span className="cq-line">{notice}</span>}
          {disabled && <div className="cq-note is-warn">{disabledNote ?? "Your role can't file claims."}</div>}
          <div className="cq-grid2">
            {fields.map((f) => {
              const id = `f-${f.name}`; const err = errors[f.name]; const v = values[f.name] ?? '';
              const help = f.maxLength ? <><span /><span>{v.length}/{f.maxLength}</span></> : undefined;
              const wrap = (child: ReactNode) => <div key={f.name} style={half(f) ? undefined : { gridColumn: '1 / -1' }}><Field id={id} label={f.label} error={err} help={help}>{child}</Field></div>;
              if (f.type === 'select') return wrap(<Dropdown label={f.label} hideLabel value={v} disabled={disabled} onChange={(x) => set(f.name, x)} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />);
              if (f.type === 'textarea') return wrap(<textarea id={id} className="cq-textarea" value={v} disabled={disabled} placeholder={f.placeholder} maxLength={f.maxLength} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} onChange={(e) => set(f.name, e.target.value)} />);
              if (f.type === 'chips') return (
                <div key={f.name} style={{ gridColumn: '1 / -1' }} className="cq-field">
                  <span className="cq-label" id={`${id}-l`}>{f.label}</span>
                  <ToggleChips value={v} onChange={(x) => set(f.name, x)} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />
                </div>);
              return wrap(<input id={id} className="cq-input" type="text" value={v} disabled={disabled} placeholder={f.placeholder} maxLength={f.maxLength} aria-invalid={!!err} onChange={(e) => set(f.name, e.target.value)} />);
            })}
          </div>
          {error && <div className="cq-note" role="alert" style={{ background: 'var(--cq-bad-bg)', color: 'var(--cq-bad)' }}>{error}</div>}
          <div className="cq-actions">
            <button type="submit" className="cq-btn is-orange" style={{ padding: '0 24px', fontSize: 15 }} disabled={disabled || submitting}>{submitting ? 'Checking...' : 'Run check'}</button>
            {result && onReset && <button type="button" className="cq-btn" onClick={onReset}>Run another check</button>}
          </div>
        </form>
        <div className="cq-flex2 cq-col">
          {result && (
            <div className="cq-card cq-card-col" aria-live="polite">
              <h2 className="cq-h2">Result</h2>
              <span className="cq-line">AI extracts the claims; plain code decides the verdict.</span>
              {result.claims.map((c, i) => (
                <div key={i} className="cq-verdict">
                  <span><Pill tone={TONE[c.verdict]} large>{LABEL[c.verdict]}</Pill></span>
                  <span>{c.text}</span>
                  {c.fact && <span className="cq-sub">Verified fact: {c.fact}</span>}
                </div>
              ))}
              {result.incident && (
                <div className="cq-note is-info">Incident {result.incident.id} created ({result.incident.severity}, {result.incident.state}). {renderLink ? renderLink(result.incident.href, 'View it') : null}</div>
              )}
              {result.sourceLabel && <span className="cq-sub">Source: {result.sourceLabel}</span>}
            </div>
          )}
          {steps && (
            <div className="cq-card cq-card-col" style={{ gap: 14 }}>
              <h2 className="cq-h2">What happens next</h2>
              {steps.map((s, i) => <div key={i} className="cq-step"><span className="cq-stepnum">{i + 1}</span><div><b>{s.title}</b><span>{s.body}</span></div></div>)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
