import { API_URL } from '../api';
import { sampleCoach } from './sampleCoach';
import { isCoachReply } from './verify';
import type { Coach, CoachReply, CoachRequest } from './types';

export class CoachError extends Error {}

// The backend contract uses source: live | mock | fallback; this app uses mode: live | sample | fallback.
function normalize(b: unknown): unknown {
  if (!b || typeof b !== 'object') return b;
  const r = { ...(b as Record<string, unknown>) };
  if (r.mode === undefined && typeof r.source === 'string') r.mode = r.source === 'mock' ? 'sample' : r.source;
  if (r.verified === undefined && r.mode !== undefined) r.verified = r.mode === 'live';
  return r;
}

// Calls the backend coach endpoint (BACKEND_CONTRACT.md section 7f, POST /api/v1/coach), where the only AI
// call lives. NEXT_PUBLIC_COACH_ENDPOINT overrides the full URL (for example a local backend); it is not a secret
// and no key lives in this app.
export const DEFAULT_COACH_ENDPOINT = `${API_URL}/api/v1/coach`;

export async function askLive(req: CoachRequest, endpoint = DEFAULT_COACH_ENDPOINT, timeoutMs = 55000): Promise<CoachReply> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ctl.signal });
    if (!res.ok) throw new CoachError(res.status === 429 ? 'Too many questions right now. Try again in a minute.' : `Coach service error (${res.status}).`);
    const body = normalize(await res.json());
    if (!isCoachReply(body)) throw new CoachError('Unexpected coach response.');
    return body;
  } catch (e) {
    if (e instanceof CoachError) throw e;
    throw new CoachError((e as Error).name === 'AbortError' ? 'The coach took too long to answer.' : 'Could not reach the coach service.');
  } finally { clearTimeout(t); }
}

// The UI only talks to this. Live errors never break the page: the built-in coach answers instead, and says so.
export function createCoach(opts: { mode?: 'sample' | 'live'; endpoint?: string } = {}): Coach {
  if (opts.mode !== 'live') return sampleCoach;
  return {
    async ask(req) {
      try { return await askLive(req, opts.endpoint || DEFAULT_COACH_ENDPOINT); }
      catch (e) { const r = await sampleCoach.ask(req); return { ...r, mode: 'fallback', note: `${(e as Error).message} Showing the built-in answer.` }; }
    },
  };
}
