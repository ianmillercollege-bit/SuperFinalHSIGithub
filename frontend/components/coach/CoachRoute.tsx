'use client';

import { useState } from 'react';
import { ErrorNotice, Loading } from '@/components/LoadState';
import { PROFILE_KEY } from '../../lib/profile/defaults';
import { useCoachContext } from '../../lib/coach/session';
import CoachPage from './CoachPage';

// The saved chat starts with a welcome line that names the person and the company. When either changes on the profile
// page, the old welcome would be stale, so a chat saved under a different name or company is cleared once.
const STAMP_KEY = `cirqo:v1:${PROFILE_KEY}:coachIdentity`;
const CHAT_KEY = `cirqo:v1:${PROFILE_KEY}:coachChat`;
function dropStaleChat(stamp: string) {
  try {
    if (sessionStorage.getItem(STAMP_KEY) !== stamp) {
      sessionStorage.removeItem(CHAT_KEY);
      sessionStorage.setItem(STAMP_KEY, stamp);
    }
  } catch { /* storage blocked: nothing to clear */ }
}

/** /coach: the kit's coach page on the dashboard's numbers. The layout supplies the frame, sidebar and the one "Sample data" badge. */
export default function CoachRoute() {
  const { ready, error, ...session } = useCoachContext();
  const stamp = `${session.firstName}|${session.businessName}`;
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  if (ready && typeof window !== 'undefined' && checkedFor !== stamp) {
    dropStaleChat(stamp);
    setCheckedFor(stamp);
  }
  if (!ready) return <Loading what="the coach" />;
  // The coach quotes the same live figures as the screens, so it does not answer from sample numbers when they are missing.
  if (error !== undefined) return <ErrorNotice error={error} onRetry={() => window.location.reload()} />;
  return <CoachPage {...session} planHref="/dashboard" />;
}
