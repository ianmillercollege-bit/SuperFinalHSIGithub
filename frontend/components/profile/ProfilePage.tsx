'use client';

import type { ReactNode } from 'react';
import ProfileView from './ProfileView';
import { defaultProfile, type AssistantId, type Profile } from '../../lib/profile/types';
import { useProfile } from '../../lib/profile/useProfile';

// Wires the view to storage. `defaults` are what "Reset to defaults" restores (for example the demo user and lib/business.ts).
export default function ProfilePage({ profileKey, defaults, headerRight, logos }: { profileKey: string; defaults: Partial<Profile> & { name: string; company: string }; headerRight?: ReactNode; logos?: Partial<Record<AssistantId, string>> }) {
  const base = defaultProfile(defaults);
  const { profile, save, reset } = useProfile(profileKey, base);
  return <ProfileView saved={profile} onSave={save} onReset={reset} headerRight={headerRight} logos={logos} />;
}
