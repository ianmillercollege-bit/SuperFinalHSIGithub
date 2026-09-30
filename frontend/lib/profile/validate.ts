import { LIMITS, type AssistantId, type Profile } from './types';

// Text is always rendered as text by React; this also strips control characters and enforces lengths.
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') : '').slice(0, max);
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

// Turns anything (old versions, hand-edited storage, wrong types) into a safe Profile.
export function sanitizeProfile(raw: unknown, defaults: Profile): Profile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const year = typeof r.memberSince === 'number' && Number.isInteger(r.memberSince) && r.memberSince >= LIMITS.memberMin && r.memberSince <= new Date().getFullYear() ? r.memberSince : defaults.memberSince;
  const a = (r.assistants && typeof r.assistants === 'object' ? r.assistants : {}) as Record<string, unknown>;
  const pick = (id: AssistantId) => (typeof a[id] === 'boolean' ? (a[id] as boolean) : defaults.assistants[id]);
  return {
    name: typeof r.name === 'string' ? clean(r.name, LIMITS.name) : defaults.name,
    jobTitle: typeof r.jobTitle === 'string' ? clean(r.jobTitle, LIMITS.jobTitle) : defaults.jobTitle,
    company: typeof r.company === 'string' ? clean(r.company, LIMITS.company) : defaults.company,
    memberSince: year,
    description: typeof r.description === 'string' ? clean(r.description, LIMITS.description) : defaults.description,
    avatar: typeof r.avatar === 'string' && r.avatar.length <= 300_000 && AVATAR_RE.test(r.avatar) ? r.avatar : null,
    assistants: { claude: pick('claude'), chatgpt: pick('chatgpt'), gemini: pick('gemini') },
  };
}

export type ProfileErrors = Partial<Record<'name' | 'jobTitle' | 'company' | 'description' | 'memberSince', string>>;
export function validateProfile(p: Profile): ProfileErrors {
  const e: ProfileErrors = {};
  if (!p.name.trim()) e.name = 'Enter your name.';
  else if (p.name.length > LIMITS.name) e.name = `Keep your name under ${LIMITS.name} characters.`;
  if (p.jobTitle.length > LIMITS.jobTitle) e.jobTitle = `Keep it under ${LIMITS.jobTitle} characters.`;
  if (!p.company.trim()) e.company = 'Enter your company name.';
  else if (p.company.length > LIMITS.company) e.company = `Keep it under ${LIMITS.company} characters.`;
  if (p.description.length > LIMITS.description) e.description = `Keep it under ${LIMITS.description} characters.`;
  if (!Number.isInteger(p.memberSince) || p.memberSince < LIMITS.memberMin || p.memberSince > new Date().getFullYear()) e.memberSince = 'Choose a valid year.';
  return e;
}

// 0-100, and the next thing worth adding.
export function completeness(p: Profile): { pct: number; next?: string } {
  const items: [boolean, string][] = [[!!p.name.trim(), 'Add your name'], [!!p.jobTitle.trim(), 'Add your job title'], [!!p.company.trim(), 'Add your company'], [!!p.description.trim(), 'Add a company description'], [!!p.avatar, 'Upload a profile picture'], [Object.values(p.assistants).some(Boolean), 'Pick an assistant to plug into']];
  return { pct: Math.round((items.filter(([ok]) => ok).length / items.length) * 100), next: items.find(([ok]) => !ok)?.[1] };
}
