'use client';

import { useMemo } from 'react';
import { createCoach } from '../../lib/coach/liveCoach';
import type { CoachSession } from '../../lib/coach/session';
import { useActionPlan } from '../../lib/coach/useActionPlan';
import ActionPlanPanel from './ActionPlanPanel';

/** The dashboard's action plan. The refresh button only exists when the live AI coach is on (it is not in sample mode). */
export default function DashboardPlan({ session }: { session: CoachSession }) {
  const { profileKey, context, mode } = session;
  const engine = useMemo(() => createCoach({ mode, endpoint: process.env.NEXT_PUBLIC_COACH_ENDPOINT || undefined }), [mode]);
  const { plan, checks, toggle, refresh, refreshing, error } = useActionPlan(profileKey, context, engine);
  return <ActionPlanPanel plan={plan} checks={checks} onToggle={toggle} askHref="/coach" {...(mode === 'live' ? { onRefresh: () => void refresh(), refreshing, error } : {})} />;
}
