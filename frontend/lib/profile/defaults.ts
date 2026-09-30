'use client';

// What the profile shows before anyone edits it, and how the rest of the app reads the saved profile.
// The profile itself is saved on this device only (localStorage, see useProfile.ts): no account, no network call.
import { useMemo } from 'react';
import { useBrandSession } from '../auth/brandSession';
import { DEFAULT_USER, useUserSession } from '../auth/userSession';
import { BUSINESS } from '../business';
import { DEMO_LOGINS } from '../auth/demoAccounts';
import { defaultProfile, type Profile } from './types';
import { useProfile } from './useProfile';

/** The id the app already uses for per-profile local storage (the coach's saved chat and plan use the same one). */
export const PROFILE_KEY = 'demo';

/** The demo user's name and job title (lib/auth/demoAccounts.ts), and the company from lib/business.ts. */
export const PROFILE_DEFAULTS = {
  name: DEFAULT_USER.name,
  jobTitle: DEMO_LOGINS[0].role.split(' · ')[0],
  company: BUSINESS.name,
  memberSince: 2024,
};

/**
 * PROFILE_DEFAULTS, but following whoever is signed in, so a different login is not shown as the demo user until the
 * person saves their own details. "Reset to defaults" on the profile page restores exactly this.
 */
export function useProfileDefaults(): Partial<Profile> & { name: string; company: string } {
  const { user } = useUserSession();
  const brand = useBrandSession();
  const name = user?.name ?? PROFILE_DEFAULTS.name;
  const jobTitle = user?.title?.split(' · ')[0] ?? PROFILE_DEFAULTS.jobTitle;
  const company = brand?.brandName ?? PROFILE_DEFAULTS.company;
  return useMemo(() => ({ ...PROFILE_DEFAULTS, name, jobTitle, company }), [name, jobTitle, company]);
}

/** The saved profile (or the defaults) and the two names the dashboard and the coach use. Nothing is copied: it is one hook. */
export function useProfileIdentity() {
  const { user } = useUserSession();
  const defaults = useProfileDefaults();
  const { profile } = useProfile(PROFILE_KEY, defaultProfile(defaults));
  return {
    profile,
    // A read-only Viewer or a signed-out visitor is greeted as "there", as before.
    firstName: user && user.role === 'owner' ? profile.name.split(/\s+/)[0] || 'there' : 'there',
    businessName: profile.company,
  };
}
