'use client';

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Field, PageHeader } from '../screens/ui';
import AvatarCircle from './Avatar';
import { AVATAR, AvatarError, processAvatar } from '../../lib/profile/avatar';
import { ASSISTANT_LOGOS } from '../../lib/profile/assistantLogos';
import { ASSISTANTS, LIMITS, type AssistantId, type Profile } from '../../lib/profile/types';
import { completeness, validateProfile } from '../../lib/profile/validate';
import type { SaveResult } from '../../lib/profile/useProfile';

export interface ProfileViewProps {
  saved: Profile; onSave: (p: Profile) => SaveResult; onReset: () => void; headerRight?: ReactNode;
  logos?: Partial<Record<AssistantId, string>>;   // defaults to lib/profile/assistantLogos.ts
}

const Camera = () => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 4l-1.5 2H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-2.5L15 4H9zm3 4.5a4 4 0 110 8 4 4 0 010-8z" fill="currentColor" /></svg>;
const Tick = () => <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const years = () => { const y = new Date().getFullYear(); return Array.from({ length: y - LIMITS.memberMin + 1 }, (_, i) => y - i); };

export default function ProfileView({ saved, onSave, onReset, headerRight, logos = ASSISTANT_LOGOS }: ProfileViewProps) {
  const [brokenLogo, setBrokenLogo] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Profile>(saved);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [avatarError, setAvatarError] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [statusText, setStatusText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // Follow the saved profile (loaded from storage, changed in another tab, or reset) unless the person is mid-edit.
  // "Mid-edit" means the draft differs from the PREVIOUS saved profile, not from the new one.
  const prevSaved = useRef(saved);
  useEffect(() => {
    const prev = JSON.stringify(prevSaved.current);   // captured now: the updater below runs later
    prevSaved.current = saved;
    setDraft((d) => (JSON.stringify(d) === prev ? saved : d));
  }, [saved]);
  useEffect(() => { if (!confirmReset) return; const t = setTimeout(() => setConfirmReset(false), 4000); return () => clearTimeout(t); }, [confirmReset]);

  const errors = validateProfile(draft);
  const valid = Object.keys(errors).length === 0;
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : undefined);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setDraft((d) => ({ ...d, [k]: v })); setStatus('idle'); };
  const blur = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const comp = completeness(draft);
  const chosen = ASSISTANTS.filter((a) => draft.assistants[a.id]).length;

  const takeFile = async (f?: File | null) => {
    if (!f) return;
    setBusy(true); setAvatarError('');
    try { set('avatar', await processAvatar(f)); }
    catch (e) { setAvatarError(e instanceof AvatarError ? e.message : "We couldn't use that image."); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); void takeFile(e.dataTransfer.files?.[0]); };

  const save = () => {
    setTouched({ name: true, company: true, jobTitle: true, description: true, memberSince: true });
    if (!valid) { setStatus('error'); setStatusText('Fix the highlighted fields to save.'); return; }
    const r = onSave(draft);
    if (r === 'ok') { setStatus('saved'); setStatusText('Profile saved on this device.'); }
    else { setStatus('error'); setStatusText(r === 'storage' ? 'Your browser would not let us save. Free some space or allow storage.' : 'Fix the highlighted fields to save.'); }
  };
  const discard = () => { setDraft(saved); setTouched({}); setAvatarError(''); setStatus('idle'); };
  const reset = () => { if (!confirmReset) { setConfirmReset(true); return; } onReset(); setConfirmReset(false); setTouched({}); setAvatarError(''); setStatus('saved'); setStatusText('Profile reset to defaults.'); };

  return (
    <>
      <PageHeader eyebrow="Your details and preferences" title="Profile" right={headerRight} />
      <div className="cq-prof">
        <aside className="cq-card cq-prof-id cq-rise" aria-label="Profile summary">
          <div className={`cq-prof-drop${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
            <AvatarCircle name={draft.name} src={draft.avatar} size={132} className="cq-prof-avatar" />
            <button type="button" className="cq-prof-cam" onClick={() => file.current?.click()} aria-label="Change profile picture" disabled={busy}><Camera /></button>
            <input ref={file} id="cq-avatar-file" className="cq-visually-hidden" type="file" accept={AVATAR.types.join(',')} aria-label="Upload profile picture" onChange={(e) => void takeFile(e.target.files?.[0])} />
          </div>
          <div className="cq-prof-photo-actions">
            <button type="button" className="cq-btn" onClick={() => file.current?.click()} disabled={busy}>{busy ? 'Processing...' : draft.avatar ? 'Change photo' : 'Upload photo'}</button>
            {draft.avatar && <button type="button" className="cq-btn is-quiet" onClick={() => { set('avatar', null); setAvatarError(''); }}>Remove</button>}
          </div>
          {avatarError ? <span className="cq-error" role="alert">{avatarError}</span> : <span className="cq-help" style={{ justifyContent: 'center', textAlign: 'center' }}>PNG, JPEG or WebP, up to 5 MB. Drop an image here or use the button. It is cropped to a square.</span>}
          <div className="cq-prof-name">
            <h2 className="cq-h2" style={{ fontSize: 22 }}>{draft.name.trim() || 'Your name'}</h2>
            <span>{[draft.jobTitle.trim(), draft.company.trim()].filter(Boolean).join(' · ') || 'Add your job title and company'}</span>
          </div>
          <span className="cq-pill is-neutral is-md">Member since {draft.memberSince}</span>
          <div className="cq-prof-meter" aria-label={`Profile ${comp.pct}% complete`}>
            <div className="cq-bar"><div style={{ width: `${comp.pct}%`, background: comp.pct === 100 ? 'var(--cq-ok)' : 'var(--cq-navy)' }} /></div>
            <span>{comp.pct}% complete{comp.next ? `. ${comp.next} to keep going.` : '. Nicely done.'}</span>
          </div>
          <span className="cq-note is-info" style={{ fontSize: 12 }}>Saved on this device only. No account is created and nothing is uploaded.</span>
        </aside>

        <div className="cq-prof-main">
          <section className="cq-card cq-card-col cq-rise" style={{ ['--i' as string]: 1, gap: 16 }} aria-labelledby="prof-details">
            <h2 className="cq-h2" id="prof-details">Your details</h2>
            <div className="cq-grid2">
              <Field id="prof-name" label="Full name" error={show('name')}>
                <input id="prof-name" className="cq-input" value={draft.name} maxLength={LIMITS.name + 10} autoComplete="name" aria-invalid={!!show('name')} aria-describedby={show('name') ? 'prof-name-err' : undefined} onChange={(e) => set('name', e.target.value)} onBlur={() => blur('name')} />
              </Field>
              <Field id="prof-title" label="Job title" error={show('jobTitle')}>
                <input id="prof-title" className="cq-input" value={draft.jobTitle} placeholder="For example, Owner" autoComplete="organization-title" aria-invalid={!!show('jobTitle')} onChange={(e) => set('jobTitle', e.target.value)} onBlur={() => blur('jobTitle')} />
              </Field>
              <Field id="prof-company" label="Company" error={show('company')}>
                <input id="prof-company" className="cq-input" value={draft.company} autoComplete="organization" aria-invalid={!!show('company')} onChange={(e) => set('company', e.target.value)} onBlur={() => blur('company')} />
              </Field>
              <Field id="prof-since" label="Member since" error={show('memberSince')}>
                <select id="prof-since" className="cq-select" value={draft.memberSince} aria-invalid={!!show('memberSince')} onChange={(e) => set('memberSince', Number(e.target.value))}>
                  {years().map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            </div>
            <Field id="prof-desc" label="Company description" error={show('description')} help={<><span>What you sell and who you sell to. Shown on your profile.</span><span aria-live="polite">{draft.description.length}/{LIMITS.description}</span></>}>
              <textarea id="prof-desc" className="cq-textarea" rows={4} value={draft.description} maxLength={LIMITS.description} placeholder="For example, we make durable camping gear for weekend adventurers." aria-invalid={!!show('description')} onChange={(e) => set('description', e.target.value)} onBlur={() => blur('description')} />
            </Field>
          </section>

          <section className="cq-card cq-card-col cq-rise" style={{ ['--i' as string]: 2, gap: 14 }} aria-labelledby="prof-plug">
            <div className="cq-title-block"><h2 className="cq-h2" id="prof-plug">Plug into your AI assistants</h2><span>Choose where you want CIRQO to plug in. Connections are not live yet, so this saves your preference only and is used once each assistant is connected.</span></div>
            <fieldset className="cq-fieldset">
              <legend className="cq-visually-hidden">AI assistants to plug into</legend>
              <div className="cq-tiles cq-stagger">
                {ASSISTANTS.map((a, i) => {
                  const on = draft.assistants[a.id];
                  return (
                    <label key={a.id} className={`cq-tile${on ? ' is-on' : ''}`} style={{ ['--i' as string]: i }}>
                      <input type="checkbox" checked={on} onChange={(e) => set('assistants', { ...draft.assistants, [a.id as AssistantId]: e.target.checked })} />
                      {logos[a.id] && !brokenLogo[a.id]
                        ? <span className="logo" aria-hidden="true"><img src={logos[a.id]} alt="" onError={() => setBrokenLogo((b) => ({ ...b, [a.id]: true }))} /></span>
                        : <span className="mono" aria-hidden="true">{a.mono}</span>}
                      <span className="t"><b>{a.name}</b><span>{a.maker}'s assistant</span></span>
                      <span className="cq-pill is-neutral is-md" style={{ whiteSpace: 'nowrap' }}>Not connected yet</span>
                      <span className="chk" aria-hidden="true"><Tick /></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <span className="cq-help" style={{ justifyContent: 'flex-start' }}>Names and logos are trademarks of their owners. CIRQO is not affiliated with or endorsed by them.</span>
            <span className="cq-help" aria-live="polite">{chosen === 0 ? 'None selected.' : `${chosen} selected: ${ASSISTANTS.filter((a) => draft.assistants[a.id]).map((a) => a.name).join(', ')}.`}</span>
          </section>

          <div className="cq-prof-bar cq-rise" style={{ ['--i' as string]: 3 }}>
            <span className={`cq-prof-status${status === 'error' ? ' is-bad' : dirty ? ' is-dirty' : ' is-ok'}`} role="status" aria-live="polite">
              {status === 'error' ? statusText : dirty ? 'You have unsaved changes.' : status === 'saved' ? <><Tick />{statusText}</> : 'All changes saved.'}
            </span>
            <div className="cq-prof-actions">
              <button type="button" className={`cq-btn is-quiet${confirmReset ? ' is-danger' : ''}`} onClick={reset}>{confirmReset ? 'Click again to confirm reset' : 'Reset to defaults'}</button>
              <button type="button" className="cq-btn" onClick={discard} disabled={!dirty}>Discard changes</button>
              <button type="button" className="cq-btn is-primary" onClick={save} disabled={!dirty}>Save changes</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
