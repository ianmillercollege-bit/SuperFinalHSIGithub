'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import CoachStudio, { type QuestionGroup, type SnapshotItem, type StarterCard } from './CoachStudio';
import { createCoach } from '../../lib/coach/liveCoach';
import { buildPlan } from '../../lib/coach/sampleCoach';
import { addActionToPlan, planTitles } from '../../lib/coach/planStore';
import { useCoachChat, coachBanner } from '../../lib/coach/useCoachChat';
import type { ActionItem, Coach, CoachContext } from '../../lib/coach/types';

export const STARTERS: StarterCard[] = [
  { title: 'Get a 30-day plan', question: 'Give me a 30 day plan.' },
  { title: 'Grow revenue', question: 'How can I increase revenue this month?' },
  { title: 'Find what is missing', question: 'Why am I missing from so many AI answers?' },
  { title: 'Explain my dashboard', question: 'Explain my dashboard to me like I am new.' },
];
export const GROUPS: QuestionGroup[] = [
  { title: 'Growth', questions: ['What is the cheapest way to gain 5 visibility points?', 'Which action gives me the most money for the least work?'] },
  { title: 'Missed answers', questions: ['Which assistant should I focus on first?', 'What is the biggest reason shoppers are not sent to me?'] },
  { title: 'Competitors', questions: ['How do I compare with national brands?', 'What would it take to move up one rank?'] },
  { title: 'Claims and trust', questions: ['Do I have anything to approve today?', 'How accurate is AI about my products?'] },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export function snapshotFrom(ctx: CoachContext): SnapshotItem[] {
  const out: SnapshotItem[] = [];
  const v = ctx.visibility, m = ctx.market, r = ctx.revenue, c = ctx.claims;
  if (v) { out.push({ label: 'Visibility score', value: String(v.score), note: `${v.score - v.previousScore >= 0 ? '+' : ''}${v.score - v.previousScore} this week` }); out.push({ label: 'Recommended', value: `${Math.round(v.recommendationFrequency * 100)}%`, note: `${v.answersRecommended} of ${v.answersTested} answers` }); }
  if (r) out.push({ label: 'Revenue estimate', value: `${usd(r.estimatePerMonth)}/mo`, note: 'Illustrative estimate' });
  if (m) out.push({ label: 'Rank (small businesses)', value: `${m.rankAmongSmallBusinesses} of ${m.smallBusinessCount}` });
  if (c) out.push({ label: 'Claims waiting', value: String(c.outstanding), note: `${c.reviewedLast30Days} reviewed in 30 days` });
  return out.slice(0, 6);
}

export interface CoachPageProps {
  profileKey: string; firstName: string; businessName: string; context: CoachContext;
  mode?: 'sample' | 'live'; endpoint?: string;
  coach?: Coach;                 // inject for tests; defaults to createCoach(mode, endpoint)
  planHref?: string; headerRight?: ReactNode;
}

export default function CoachPage({ profileKey, firstName, businessName, context, mode = 'sample', endpoint, coach, planHref, headerRight }: CoachPageProps) {
  const engine = useMemo(() => coach ?? createCoach({ mode, endpoint }), [coach, mode, endpoint]);
  const live = mode === 'live';
  const greeting = `Hi ${firstName}, I'm your CIRQO coach for ${businessName}.\nI ${live ? 'answer from your dashboard data, and every number is checked against it' : 'give pre-written demo answers built from your dashboard numbers'}.`;
  const chat = useCoachChat(profileKey, context, engine, greeting);
  const [added, setAdded] = useState<string[]>([]);
  useEffect(() => setAdded(planTitles(profileKey)), [profileKey]);   // after mount, so server and browser markup match
  const [toast, setToast] = useState('');
  const base = useMemo(() => buildPlan(context), [context]);
  const add = (a: ActionItem) => {
    const r = addActionToPlan(profileKey, a, base);
    setAdded(planTitles(profileKey).length ? planTitles(profileKey) : [a.title]);
    setToast(r === 'added' ? 'Added to your action plan on the dashboard.' : r === 'exists' ? 'Already in your plan.' : 'Your plan is full (8 actions). Finish some steps first.');
    setTimeout(() => setToast(''), 2600);
  };
  return (
    <>
      <CoachStudio live={live} banner={coachBanner(live)} messages={chat.messages} sending={chat.sending} error={chat.error}
        snapshot={snapshotFrom(context)} dataLabel={context.dataLabel === 'live' ? 'Live data' : context.dataLabel === 'mixed' ? 'Partly sample data' : 'Sample data'}
        starters={STARTERS} groups={GROUPS} addedTitles={added} onAddToPlan={add} planHref={planHref}
        onSend={chat.send} onRetry={chat.retry} onRegenerate={chat.regenerate} onClear={chat.clear} headerRight={headerRight} />
      <div className="cq-visually-hidden" role="status" aria-live="polite">{toast}</div>
      {toast && <div className="cq-note is-info cq-rise" style={{ position: 'fixed', bottom: 24, right: 24, boxShadow: '0 8px 24px rgba(12,35,64,0.18)', background: 'var(--cq-navy)', color: 'var(--cq-on-navy)', zIndex: 50 }}>{toast}</div>}
    </>
  );
}
