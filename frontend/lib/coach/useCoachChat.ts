'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../components/screens/CoachView';
import type { Coach, CoachContext } from './types';

const DEMO_NOTE = 'Demo: pre-written answers, not a live AI.';
export const coachBanner = (live: boolean) => (live ? 'AI coach: answers use your dashboard data, and every number is checked against it.' : DEMO_NOTE);

// Chat state for the coach page. The page passes the coach from createCoach() and never sees which one is active.
export function useCoachChat(profileKey: string, context: CoachContext, coach: Coach, greeting: string) {
  const key = `cirqo:v1:${profileKey}:coachChat`;
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'g', role: 'coach', text: greeting }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const lastQ = useRef<string | null>(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { try { const s = sessionStorage.getItem(key); if (s) { const v = JSON.parse(s) as ChatMessage[]; if (Array.isArray(v) && v.length) setMessages(v); } } catch { /* ignore */ } }, [key]);
  const save = (m: ChatMessage[]) => { try { sessionStorage.setItem(key, JSON.stringify(m)); } catch { /* ignore */ } };

  const send = useCallback(async (text: string) => {
    const q = text.trim(); if (!q) return;
    lastQ.current = q; setError(undefined); setSending(true);
    const withUser: ChatMessage[] = [...messagesRef.current, { id: `u${Date.now()}`, role: 'user', text: q }];
    setMessages(withUser); messagesRef.current = withUser; save(withUser);
    try {
      // The backend accepts up to 200 turns and reads the last few; a long chat sends only its tail.
      const history = withUser.slice(0, -1).filter((m) => m.id !== 'g').slice(-40).map((m) => ({ role: m.role, text: m.text }));
      const r = await coach.ask({ question: q, history, context });
      const reply: ChatMessage = { id: `c${Date.now()}`, role: 'coach', text: r.answer, sources: r.sources.map((s) => `${s.label}: ${s.value}`), actions: r.actions, meta: { mode: r.mode, verified: r.verified, note: r.note } };
      const next = [...withUser, reply]; setMessages(next); messagesRef.current = next; save(next);
    } catch (e) { setError((e as Error).message || 'The coach could not answer.'); }
    finally { setSending(false); }
  }, [coach, context, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const regenerate = useCallback(() => {
    if (!lastQ.current) return;
    setMessages((m) => { const i = m.length - 1; const next = m[i]?.role === 'coach' && m[i].id !== 'g' ? m.slice(0, i) : m; const n2 = next[next.length - 1]?.role === 'user' ? next.slice(0, -1) : next; save(n2); messagesRef.current = n2; return n2; });
    setTimeout(() => void send(lastQ.current as string), 0);
  }, [send]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => { const g: ChatMessage[] = [{ id: 'g', role: 'coach', text: greeting }]; setMessages(g); setError(undefined); try { sessionStorage.removeItem(key); } catch { /* ignore */ } }, [greeting, key]);
  const retry = useCallback(() => { if (lastQ.current) void send(lastQ.current); }, [send]);
  return { messages, sending, error, send, clear, retry, regenerate };
}
