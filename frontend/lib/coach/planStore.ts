import type { ActionItem, CoachMode } from './types';

// Lets the coach page add an action to the dashboard's action plan. Same storage key as useActionPlan.
const KEY = (profile: string) => `cirqo:v1:${profile}:coachPlan`;
interface Stored { actions: ActionItem[]; mode: CoachMode; verified: boolean; generatedAt?: string; note?: string }
export const MAX_PLAN_ACTIONS = 8;

function read(profile: string): Stored | null {
  try { const s = localStorage.getItem(KEY(profile)); if (!s) return null; const v = JSON.parse(s) as Stored; return Array.isArray(v.actions) ? v : null; } catch { return null; }
}
export function planTitles(profile: string): string[] { return read(profile)?.actions.map((a) => a.title) ?? []; }

// `base` is the plan to start from when nothing is saved yet (the built-in plan the dashboard shows).
export function addActionToPlan(profile: string, action: ActionItem, base: ActionItem[]): 'added' | 'exists' | 'full' {
  const cur = read(profile) ?? { actions: base, mode: 'sample' as CoachMode, verified: true };
  if (cur.actions.some((a) => a.title === action.title)) return 'exists';
  if (cur.actions.length >= MAX_PLAN_ACTIONS) return 'full';
  const next: Stored = { ...cur, actions: [...cur.actions, { ...action, id: `act_${cur.actions.length + 1}` }] };
  try { localStorage.setItem(KEY(profile), JSON.stringify(next)); } catch { return 'full'; }
  return 'added';
}
