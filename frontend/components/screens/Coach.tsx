"use client";

import { useCallback, useRef, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import CoachView from "@/components/screens/CoachView";
import type { ChatMessage } from "@/components/screens/CoachView";
import { SampleTag } from "@/components/screens/SampleTag";
import { SUGGESTED_QUESTIONS, askCoach, loadCoachContext } from "@/lib/coach";
import { describeError } from "@/lib/errors";
import { useApi } from "@/lib/useApi";

const BANNER = "Demo: pre-written answers, not a live AI.";

/** /coach: the kit's chat view on the existing sample coach provider (DECISIONS.md #11). */
export default function Coach() {
  const context = useApi(useCallback(() => loadCoachContext(), []));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const lastQuestion = useRef("");
  const nextId = useRef(1);

  if (context.loading) return <Loading what="sample business data" />;
  if (context.error !== undefined) return <ErrorNotice error={context.error} onRetry={context.reload} />;

  async function ask(text: string, addUserMessage = true) {
    lastQuestion.current = text;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    if (addUserMessage) setMessages((list) => [...list, { id: `m_${nextId.current++}`, role: "user", text }]);
    setSending(true);
    setError(undefined);
    try {
      const reply = await askCoach(text, history, context.data!);
      setMessages((list) => [
        ...list,
        { id: `m_${nextId.current++}`, role: "coach", text: reply.text, sources: reply.sources.map((s) => `${s.label}: ${s.value}`) },
      ]);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <CoachView
      banner={BANNER}
      messages={messages}
      suggestions={SUGGESTED_QUESTIONS.map((s) => s.question)}
      sending={sending}
      error={error}
      onSend={(text) => void ask(text)}
      onClear={() => {
        setMessages([]);
        setError(undefined);
      }}
      onRetry={() => void ask(lastQuestion.current, false)}
      headerRight={<SampleTag />}
    />
  );
}
