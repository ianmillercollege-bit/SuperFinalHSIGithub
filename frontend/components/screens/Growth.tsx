"use client";

import { useCallback, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import RevenueEstimate from "@/components/RevenueEstimate";
import { COACH_DEMO_DISCLAIMER, SUGGESTED_QUESTIONS, askCoach, loadCoachContext } from "@/lib/coach";
import type { CoachContext } from "@/lib/coach";
import { formatChange } from "@/lib/format";
import type { CoachMessage, CoachReply } from "@/lib/schema";
import { allLeversOn, simulate } from "@/lib/simulator";
import { useApi } from "@/lib/useApi";

// Frontend-only extra on the frontend's own sample business (DECISIONS.md #11).
export default function Growth() {
  const context = useApi(useCallback(() => loadCoachContext(), []));

  if (context.loading) return <Loading what="sample business data" />;
  if (context.error !== undefined) return <ErrorNotice error={context.error} onRetry={context.reload} />;
  const ctx = context.data!;
  const { overview, baseline } = ctx;
  const potential = simulate(allLeversOn(baseline.levers), baseline, baseline.assumptions);

  return (
    <div className="stack">
      <section className="card stack">
        <p className="eyebrow">
          {overview.business.category} · {overview.business.region}
        </p>
        <h2>{overview.business.name}</h2>
        <p>
          AI Visibility Score <span className="big-number">{overview.visibilityScore}/100</span>{" "}
          <span className="muted">
            ({formatChange(overview.weeklyChange)} from last week)
          </span>
        </p>
      </section>
      <RevenueEstimate result={potential} assumptions={baseline.assumptions} />
      <Coach context={ctx} />
    </div>
  );
}

function Coach({ context }: { context: CoachContext }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<(CoachMessage & { reply?: CoachReply })[]>([]);
  const [thinking, setThinking] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setThinking(true);
    setQuestion("");
    const reply = await askCoach(trimmed, history, context);
    setHistory((h) => [...h, { role: "user", text: trimmed }, { role: "coach", text: reply.text, reply }]);
    setThinking(false);
  }

  return (
    <section className="card stack">
      <h2>Growth coach</h2>
      <p className="demo-note">{COACH_DEMO_DISCLAIMER}</p>
      <div className="chip-row">
        {SUGGESTED_QUESTIONS.map(({ question: q }) => (
          <button key={q} type="button" className="chip" onClick={() => void ask(q)}>
            {q}
          </button>
        ))}
      </div>
      <ul className="chat">
        {history.map((m, i) => (
          <li key={i} className={`bubble bubble-${m.role}`}>
            <p>{m.text}</p>
            {m.reply && (
              <div className="chip-row">
                {m.reply.sources.map((s) => (
                  <span key={`${s.label}-${s.value}`} className="source-chip">
                    {s.label}: {s.value}
                  </span>
                ))}
                <span className="muted small">{m.reply.disclaimer}</span>
              </div>
            )}
          </li>
        ))}
        {thinking && <li className="muted small">Finding a pre-written answer…</li>}
      </ul>
      <form
        className="coach-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your AI visibility" />
        <button type="submit" className="button">
          Ask
        </button>
      </form>
    </section>
  );
}
