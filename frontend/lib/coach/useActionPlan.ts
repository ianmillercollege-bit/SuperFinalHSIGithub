'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildPlan } from './sampleCoach';
import { PLAN_QUESTION, type ActionItem, type Coach, type CoachContext, type CoachMode } from './types';

export interface ActionPlan { actions: ActionItem[]; mode: CoachMode; verified: boolean; generatedAt?: string; note?: string }

// Dashboard action plan: starts as the built-in plan, restores a saved AI plan after mount, refreshes on demand.
// profileKey isolates each signed-in profile (same idea as the rest of the app's per-profile storage).
export function useActionPlan(profileKey: string, context: CoachContext, coach: Coach) {
  const planKey = `cirqo:v1:${profileKey}:coachPlan`, checkKey = `cirqo:v1:${profileKey}:coachChecks`;
  const [plan, setPlan] = useState<ActionPlan>(() => ({ actions: buildPlan(context), mode: 'sample', verified: true }));
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {   // after mount, so server and client markup match
    try {
      const p = localStorage.getItem(planKey); if (p) { const v = JSON.parse(p) as ActionPlan; if (Array.isArray(v.actions)) setPlan(v); }
      const c = localStorage.getItem(checkKey); if (c) setChecks(JSON.parse(c) as Record<string, boolean>);
    } catch { /* corrupt storage: keep defaults */ }
  }, [planKey, checkKey]);

  const toggle = useCallback((key: string) => setChecks((prev) => {
    const next = { ...prev, [key]: !prev[key] };
    try { localStorage.setItem(checkKey, JSON.stringify(next)); } catch { /* storage full or blocked */ }
    return next;
  }), [checkKey]);

  const refresh = useCallback(async () => {
    setRefreshing(true); setError(undefined);
    try {
      const r = await coach.ask({ question: PLAN_QUESTION, history: [], context });
      const next: ActionPlan = { actions: r.actions.length ? r.actions : buildPlan(context), mode: r.mode, verified: r.verified, generatedAt: r.generatedAt, note: r.note };
      setPlan(next);
      try { localStorage.setItem(planKey, JSON.stringify(next)); } catch { /* ignore */ }
    } catch (e) { setError((e as Error).message || 'Could not refresh the plan.'); }
    finally { setRefreshing(false); }
  }, [coach, context, planKey]);

  return { plan, checks, toggle, refresh, refreshing, error };
}
