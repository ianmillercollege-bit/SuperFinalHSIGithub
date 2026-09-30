'use client';

import { useState } from 'react';
import BrandLockup from './BrandLockup';
import { Field, SampleBadge } from './ui';

export interface LoginViewProps {
  accounts: { name: string; role: string; email: string; password?: string }[];   // demo rows; the password only fills the field and is never displayed
  onSubmit: (email: string, password: string) => void;
  submitting?: boolean;
  error?: string;
  headline?: string;
  warning?: string;
}

export default function LoginView({ accounts, onSubmit, submitting, error, headline = 'Know what AI tells shoppers about your business.', warning = "Demo login: not real authentication. Don't enter a real password." }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [local, setLocal] = useState<{ email?: string; password?: string }>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = { email: email.trim() ? '' : 'Enter your email.', password: password ? '' : 'Enter your password.' };
    setLocal(n);
    if (n.email) return document.getElementById('login-email')?.focus();
    if (n.password) return document.getElementById('login-password')?.focus();
    onSubmit(email.trim(), password);
  };
  return (
    <div className="cq-login">
      <div className="cq-login-brand">
        <BrandLockup large />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 540 }}>
          <h1>{headline}</h1>
          <p>See how often assistants recommend you, check what they say against verified facts, and keep a named person in charge of every fix.</p>
        </div>
        <span style={{ fontSize: 13, color: 'var(--cq-on-navy-muted)' }}>Ranking is never influenced by payment.</span>
      </div>
      <div className="cq-login-side">
        <div className="corner"><SampleBadge /></div>
        <form className="cq-login-card" onSubmit={submit} noValidate>
          <h2 className="cq-h1" style={{ fontSize: 28 }}>Sign in</h2>
          <Field id="login-email" label="Email" error={local.email}>
            <input id="login-email" className="cq-input" type="email" autoComplete="username" value={email} aria-invalid={!!local.email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="login-password" label="Password" error={local.password}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="login-password" className="cq-input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} aria-invalid={!!local.password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="cq-btn" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </Field>
          {error && <div className="cq-note" role="alert" style={{ background: 'var(--cq-bad-bg)', color: 'var(--cq-bad)' }}>{error}</div>}
          <button type="submit" className="cq-btn is-primary" style={{ minHeight: 48, fontSize: 15 }} disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
          <div className="cq-col" style={{ gap: 8, paddingTop: 8, borderTop: '1px solid var(--cq-border)' }}>
            <span className="cq-sub" style={{ fontWeight: 600 }}>Demo accounts (click to fill)</span>
            {accounts.map((a) => (
              <button key={a.email} type="button" className="cq-account" onClick={() => { setEmail(a.email); setPassword(a.password ?? ''); setLocal({}); }}>
                <b style={{ fontWeight: 600 }}>{a.name}</b><span className="cq-muted">{a.role}</span>
              </button>
            ))}
          </div>
          <span className="cq-note is-warn">{warning}</span>
        </form>
      </div>
    </div>
  );
}
