'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sanitizeProfile, validateProfile } from './validate';
import type { Profile } from './types';

const KEY = (profileKey: string) => `cirqo:v1:${profileKey}:profile`;
const EVENT = 'cirqo-profile-changed';

export type SaveResult = 'ok' | 'invalid' | 'storage';

// Profile saved on this device only (localStorage). Every component that calls this stays in sync, including the sidebar,
// because save() and reset() broadcast a change. Starts as `defaults` so server and browser markup match, then loads.
export function useProfile(profileKey: string, defaults: Profile) {
  const dkey = JSON.stringify(defaults);
  const stable = useMemo(() => JSON.parse(dkey) as Profile, [dkey]);
  const [profile, setProfile] = useState<Profile>(stable);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    try { const raw = localStorage.getItem(KEY(profileKey)); setProfile(raw ? sanitizeProfile(JSON.parse(raw), stable) : stable); }
    catch { setProfile(stable); }   // corrupt storage: fall back to defaults
  }, [profileKey, stable]);

  useEffect(() => {
    load(); setLoaded(true);
    window.addEventListener(EVENT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVENT, load); window.removeEventListener('storage', load); };
  }, [load]);

  const save = useCallback((p: Profile): SaveResult => {
    const clean = sanitizeProfile(p, stable);
    if (Object.keys(validateProfile(clean)).length) return 'invalid';
    try { localStorage.setItem(KEY(profileKey), JSON.stringify(clean)); } catch { return 'storage'; }
    setProfile(clean); window.dispatchEvent(new Event(EVENT)); return 'ok';
  }, [profileKey, stable]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY(profileKey)); } catch { /* ignore */ }
    setProfile(stable); window.dispatchEvent(new Event(EVENT));
  }, [profileKey, stable]);

  return { profile, loaded, save, reset };
}

// The `user` prop for the sidebar chip, from the saved profile.
export function useSidebarUser(profileKey: string, defaults: Profile) {
  const { profile } = useProfile(profileKey, defaults);
  return { name: profile.name, role: profile.jobTitle || 'Member', business: profile.company, avatarUrl: profile.avatar };
}
