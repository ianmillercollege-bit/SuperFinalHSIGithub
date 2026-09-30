export type AssistantId = 'claude' | 'chatgpt' | 'gemini';

export interface Profile {
  name: string; jobTitle: string; company: string;
  memberSince: number;                       // a year, e.g. 2024
  description: string;
  avatar: string | null;                     // small square JPEG/PNG/WebP data URL, or null
  assistants: Record<AssistantId, boolean>;  // which assistants the person wants CIRQO to plug into (preference only for now)
}

// Names only, no logos. `mono` is the two-letter tile label.
export const ASSISTANTS: { id: AssistantId; name: string; maker: string; mono: string }[] = [
  { id: 'claude', name: 'Claude', maker: 'Anthropic', mono: 'Cl' },
  { id: 'chatgpt', name: 'ChatGPT', maker: 'OpenAI', mono: 'Ch' },
  { id: 'gemini', name: 'Gemini', maker: 'Google', mono: 'Ge' },
];

export const LIMITS = { name: 60, jobTitle: 60, company: 80, description: 300, memberMin: 2015 } as const;

export function defaultProfile(base: Partial<Profile> & { name: string; company: string }): Profile {
  return {
    name: base.name, jobTitle: base.jobTitle ?? '', company: base.company,
    memberSince: base.memberSince ?? new Date().getFullYear(), description: base.description ?? '',
    avatar: null, assistants: { claude: false, chatgpt: false, gemini: false, ...(base.assistants ?? {}) },
  };
}
