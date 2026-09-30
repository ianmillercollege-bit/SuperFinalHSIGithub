// DEMO BRIDGE: server-side route that calls the Anthropic Messages API. The key lives ONLY in the server env var
// ANTHROPIC_API_KEY (Vercel project settings). Never prefix it with NEXT_PUBLIC_ and never commit it.
// Your brief puts AI calls in the backend (services/ai_client.py): get the lead's explicit OK before shipping this,
// or point NEXT_PUBLIC_COACH_ENDPOINT at the backend endpoint and delete this file.
import { LIMITS, type CoachContext, type CoachRequest, type CoachReply } from '../../../lib/coach/types';
import { SYSTEM_PROMPT, TOOL, buildUserMessage } from '../../../lib/coach/spec';
import { isGeneric, validateModelOutput, verifyReply } from '../../../lib/coach/verify';
import { answerFor, buildPlan } from '../../../lib/coach/sampleCoach';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = () => process.env.COACH_MODEL || 'claude-sonnet-5-5';
const PER_MIN = () => Number(process.env.COACH_RATE_PER_MIN || 10);
const DAILY_CAP = () => Number(process.env.COACH_DAILY_CAP || 300);

// In-memory limits are per server instance: fine for a demo, not a real spend control. Also set a spend limit in the
// Anthropic console, and use Vercel's firewall or a shared store for real protection.
const hits = new Map<string, number[]>();
let day = { key: '', count: 0 };
export function __resetLimits() { hits.clear(); day = { key: '', count: 0 }; }
function limited(ip: string): boolean {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  if (day.key !== today) day = { key: today, count: 0 };
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  if (recent.length >= PER_MIN() || day.count >= DAILY_CAP()) { hits.set(ip, recent); return true; }
  recent.push(now); hits.set(ip, recent); day.count++;
  return false;
}

// Error codes here are placeholders: replace with the contract's error-code list before this ships.
const err = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

function parseRequest(body: unknown): CoachRequest | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  const b = body as Record<string, unknown>;
  if (typeof b.question !== 'string' || !b.question.trim() || b.question.length > LIMITS.question) return `question must be 1 to ${LIMITS.question} characters.`;
  const history = Array.isArray(b.history) ? b.history : [];
  const h = history.slice(-LIMITS.historyTurns).map((t) => t as Record<string, unknown>);
  if (!h.every((t) => (t.role === 'user' || t.role === 'coach') && typeof t.text === 'string')) return 'history is invalid.';
  const c = b.context as CoachContext | undefined;
  if (!c || typeof c !== 'object' || typeof c.business?.name !== 'string' || typeof c.asOf !== 'string') return 'context is invalid.';
  if (JSON.stringify(c).length > LIMITS.contextBytes) return 'context is too large.';
  return { question: b.question, history: h.map((t) => ({ role: t.role as 'user' | 'coach', text: (t.text as string).slice(0, LIMITS.historyChars) })), context: c };
}

async function callModel(key: string, user: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    // tool_choice stays "auto": some newer models reject forced tool choice, so the prompt instructs the tool call.
    body: JSON.stringify({ model: MODEL(), max_tokens: 1800, system: SYSTEM_PROMPT, tools: [TOOL], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const tool = data.content?.find((b) => b.type === 'tool_use' && b.name === TOOL.name);
  if (!tool) throw new Error('no tool call');
  return tool.input;
}

function fallback(req: CoachRequest, note: string): CoachReply {
  const { answer, sources } = answerFor(req.question, req.context);
  return { answer, sources, actions: buildPlan(req.context), mode: 'fallback', verified: true, generatedAt: new Date().toISOString(), note };
}

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  if (limited(ip)) return err(429, 'RATE_LIMITED', 'Too many coach requests. Try again in a minute.');
  let parsed: CoachRequest | string;
  try { parsed = parseRequest(await request.json()); } catch { return err(400, 'VALIDATION_ERROR', 'Body must be valid JSON.'); }
  if (typeof parsed === 'string') return err(400, 'VALIDATION_ERROR', parsed);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json(fallback(parsed, 'The AI model is not configured on the server, so this is the built-in answer.'));

  // Total budget ~50 s (Vercel allows 60 with maxDuration). A retry only starts if there is time left.
  const deadline = Date.now() + 50000;
  let correction: string | undefined;
  let numbersFailed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (attempt > 0 && left < 12000) break;
    try {
      const out = validateModelOutput(await callModel(key, buildUserMessage(parsed, correction), Math.min(28000, left - 1000)));
      if (!out.ok) { correction = `Your last reply was invalid (${out.error}). Call submit_coaching with every required field.`; continue; }
      const bad = verifyReply(out.value, parsed.context);
      if (bad.length) { numbersFailed = true; correction = `These numbers are not in the data: ${bad.slice(0, 6).join(', ')}. Rewrite using only numbers from <context>.`; continue; }
      // Vague advice gets one nudge; if the second try is still vague we accept it (it is safe, just less sharp).
      if (attempt === 0 && isGeneric(out.value, parsed.context)) { correction = 'That was too generic. Name at least 2 specific items from <context> (assistants, competitors, miss reasons, opportunities or real shopper questions) and quote at least 3 numbers from derivedFacts.'; continue; }
      return Response.json({ ...out.value, mode: 'live', verified: true, generatedAt: new Date().toISOString() } satisfies CoachReply);
    } catch (e) {
      console.error('coach model error:', (e as Error).message);   // status only: never log keys or content
      if (attempt === 1) break;
    }
  }
  return Response.json(fallback(parsed, numbersFailed ? 'The AI answer included numbers that could not be verified against your data, so this is the built-in answer.' : 'The AI model was unavailable, so this is the built-in answer.'));
}
