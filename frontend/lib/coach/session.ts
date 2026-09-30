'use client';

// The app's side of the AI Coach: turns the dashboard's numbers into the coach's context. Sample mode unless
// NEXT_PUBLIC_COACH_MODE is exactly "live" (it is unset). No AI is called in sample mode.
//
// The kit's contextFromKit starts from the kit's own sample data. Every figure the app also shows on a screen is then
// replaced with the same live figure the screen uses (lib/dashboard/liveVisibility.ts), and the derived facts are
// recomputed, so the coach can never quote a number that differs from the dashboard, AI Visibility or Market Position.
import { useMemo } from 'react';
import { useProfileIdentity } from '../profile/defaults';
import { liveVisibility, rankByScore, type LiveVisibility } from '../dashboard/liveVisibility';
import { sampleDashboard } from '../dashboard/sampleDashboard';
import type { DashboardData } from '../dashboard/useDashboardVm';
import { useDashboardVm } from '../dashboard/useDashboardVm';
import { sampleOpportunities } from '../screens/samples';
import { contextFromKit } from './contextFromKit';
import type { TrustMetrics } from '../types';
import { deriveFacts } from './facts';
import type { CoachContext } from './types';

export type CoachSession = {
  profileKey: string; firstName: string; businessName: string; context: CoachContext; mode: 'sample' | 'live';
  /** False until the dashboard's numbers have loaded. */
  ready: boolean;
  /** Set when a live figure the coach needs could not be loaded; the coach page shows it instead of guessing. */
  error?: unknown;
};

const rate = (n: number) => Math.round(n * 100) / 100;

/** The live claim counts and trust rates the coach quotes, in the coach's shape. Shared with the consistency check. */
export function liveCoachInputs(trust: TrustMetrics | undefined, claims: { open: number; decided: number } | undefined) {
  return {
    claims: claims ? { outstanding: claims.open, reviewedLast30Days: claims.decided } : undefined,
    trust: trust && trust.daily.length > 0
      ? { accuracyRate: rate(trust.current.accuracyRate), hallucinationRate: rate(trust.current.hallucinationRate), timeToResolveHours: Math.round(trust.current.medianTimeToResolveHours * 10) / 10, days: trust.daily.length, accuracyRateStart: rate(trust.daily[0].accuracyRate) }
      : undefined,
  };
}

/** Replaces the kit's sample visibility and market figures with the live ones. Pure, so it is easy to test. */
export function withLiveVisibility(ctx: CoachContext, live: LiveVisibility, change: number): CoachContext {
  const next: CoachContext = { ...ctx };
  const opps = next.opportunities ?? [];
  const totalLift = opps.reduce((s, o) => s + o.liftPoints, 0);
  const sorted = [...live.assistants].sort((a, b) => b.frequency - a.frequency);
  const lead = [...opps].sort((a, b) => b.liftPoints - a.liftPoints)[0];
  next.visibility = {
    score: live.score,
    previousScore: live.score - change,
    recommendationFrequency: rate(live.rate),
    answersTested: live.tested, answersRecommended: live.recommended, answersMissed: live.missed,
    strongestAssistant: sorted[0] && { name: sorted[0].name, frequency: rate(sorted[0].frequency) },
    weakestAssistant: sorted[sorted.length - 1] && { name: sorted[sorted.length - 1].name, frequency: rate(sorted[sorted.length - 1].frequency) },
    // The contract records no reason for a missed answer, so the one honest reason is that the business was not named.
    missReasons: live.missed > 0 && lead ? [{ label: 'Not named in the answer', count: live.missed, fix: lead.title, examples: live.missedQuestions.slice(0, 2).map((q) => ({ question: q.question, assistants: q.missedBy })) }] : [],
  };
  const rows = live.competitors;
  const closed = Math.min(100, live.score + totalLift);
  next.market = {
    rankAmongSmallBusinesses: rankByScore(live.score, rows), smallBusinessCount: rows.length + 1,
    rankOverall: rankByScore(live.score, rows), businessCount: rows.length + 1,
    shareOfVoice: rate(live.shareOfVoice), nationalShare: 0, peerShare: rate(rows.reduce((s, c) => s + c.shareOfVoice, 0)),
    scoreIfAllGapsClosed: closed, rankOverallIfAllGapsClosed: rankByScore(closed, rows), rankSmallIfAllGapsClosed: rankByScore(closed, rows),
  };
  next.competitors = rows.map((c) => ({ name: c.name, type: 'small business' as const, score: c.score, averageRank: c.averageRank, shareOfVoice: rate(c.shareOfVoice), recommendationFrequency: rate(c.frequency) }));
  next.assistants = live.assistants.map((a) => ({ name: a.name, frequency: rate(a.frequency), answersRecommended: a.recommended, answersTested: a.tested, missedQuestions: a.missedQuestions }));
  next.topMissedQuestions = live.missedQuestions.slice(0, 5).map((q) => ({ question: q.question, missedBy: q.missedBy }));
  // The weekly chart on the dashboard is the seeded trend, not this score, so the coach does not quote it against the score.
  next.weeklyScores = undefined;
  next.sampleSections = (ctx.sampleSections ?? []).filter((k) => k !== 'visibility' && k !== 'market');
  next.dataLabel = 'mixed';
  next.derivedFacts = deriveFacts(next);
  return next;
}

/** Builds the session from dashboard data the caller already has (the dashboard passes its own, so nothing loads twice). */
export function useCoachContextFrom(dash: DashboardData): CoachSession {
  // Name and company come from the saved profile, the same hook the dashboard greeting uses.
  const { firstName, businessName } = useProfileIdentity();
  // The app keeps no per-profile id for local storage yet, so one shared key: 'demo'.
  const profileKey = 'demo';
  const mode = process.env.NEXT_PUBLIC_COACH_MODE === 'live' ? 'live' : 'sample';
  const { vm, trust, claims, summary, answers } = dash;
  const ready = !trust.loading && !claims.loading && !summary.loading && !answers.loading;
  const error = summary.error ?? answers.error;

  const t = trust.data;
  const inputs = liveCoachInputs(t, claims.data);
  const s = summary.data;
  const a = answers.data;

  const context = useMemo(() => {
    const base = contextFromKit({ businessName, vm: vm ?? sampleDashboard, opportunities: sampleOpportunities, live: inputs });
    return s && a ? withLiveVisibility(base, liveVisibility(s, a.answers), vm?.score?.changeVsLastWeek ?? 0) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessName, vm, inputs.claims?.outstanding, inputs.claims?.reviewedLast30Days, t, s, a]);
  return { profileKey, firstName, businessName, context, mode, ready, error };
}

export function useCoachContext(): CoachSession {
  return useCoachContextFrom(useDashboardVm());
}
