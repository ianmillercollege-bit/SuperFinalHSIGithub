'use client';

// The app's side of the AI Coach: turns the dashboard's numbers into the coach's context. Sample mode unless
// NEXT_PUBLIC_COACH_MODE is exactly "live" (it is unset). No AI is called in sample mode.
import { useMemo } from 'react';
import { useBrandSession } from '../auth/brandSession';
import { useUserSession } from '../auth/userSession';
import { BUSINESS } from '../business';
import type { DashboardData } from '../dashboard/useDashboardVm';
import { useDashboardVm } from '../dashboard/useDashboardVm';
import { sampleDashboard } from '../dashboard/sampleDashboard';
import { sampleOpportunities } from '../screens/samples';
import { contextFromKit } from './contextFromKit';
import type { CoachContext } from './types';

export type CoachSession = {
  profileKey: string; firstName: string; businessName: string; context: CoachContext; mode: 'sample' | 'live';
  /** False until the dashboard's numbers have loaded. */
  ready: boolean;
};

const rate = (n: number) => Math.round(n * 100) / 100;

/** Builds the session from dashboard data the caller already has (the dashboard passes its own, so nothing loads twice). */
export function useCoachContextFrom(dash: DashboardData): CoachSession {
  const { user } = useUserSession();
  const brand = useBrandSession();
  const businessName = brand?.brandName ?? BUSINESS.name;
  const firstName = user && user.role === 'owner' ? user.name.split(/\s+/)[0] : 'there';
  // The app keeps no per-profile id for local storage yet, so one shared key: 'demo'.
  const profileKey = 'demo';
  const mode = process.env.NEXT_PUBLIC_COACH_MODE === 'live' ? 'live' : 'sample';
  const { vm, trust, claims } = dash;
  const ready = !trust.loading && !claims.loading;

  const liveClaims = claims.data ? { outstanding: claims.data.open, reviewedLast30Days: claims.data.decided } : undefined;
  const t = trust.data;
  const liveTrust = t && t.daily.length > 0
    ? { accuracyRate: rate(t.current.accuracyRate), hallucinationRate: rate(t.current.hallucinationRate), timeToResolveHours: Math.round(t.current.medianTimeToResolveHours * 10) / 10, days: t.daily.length, accuracyRateStart: rate(t.daily[0].accuracyRate) }
    : undefined;

  const context = useMemo(
    () => contextFromKit({ businessName, vm: vm ?? sampleDashboard, opportunities: sampleOpportunities, live: { claims: liveClaims, trust: liveTrust } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [businessName, vm, liveClaims?.outstanding, liveClaims?.reviewedLast30Days, t],
  );
  return { profileKey, firstName, businessName, context, mode, ready };
}

export function useCoachContext(): CoachSession {
  return useCoachContextFrom(useDashboardVm());
}
