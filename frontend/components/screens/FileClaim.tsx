"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { getAnswers, getVisibilitySummary, runChecker } from "@/lib/api";
import { describeError } from "@/lib/errors";
import { notifyIncidentsChanged } from "@/lib/events";
import { CLAIM_STATUS_LABELS, RULE_LABELS } from "@/lib/labels";
import { CLAIM_STATUS_TONES } from "@/lib/tones";
import type { CheckerRunRequest, CheckerRunResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Mode = "paste" | "recorded";

/** File a Claim = POST /api/v1/checker/run (DECISIONS.md #27). */
export default function FileClaim() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const answers = useApi(useCallback(() => getAnswers({ limit: 50 }), []));
  const [mode, setMode] = useState<Mode>("paste");
  const [queryText, setQueryText] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [answerId, setAnswerId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [result, setResult] = useState<CheckerRunResponse | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let body: CheckerRunRequest;
    if (mode === "paste") {
      if (!queryText.trim() || !assistantId || !answerText.trim()) {
        return setFormError("Fill in the shopper's question, the assistant, and what the assistant said.");
      }
      body = { answerText: answerText.trim(), assistantId, queryText: queryText.trim() };
    } else {
      if (!answerId) return setFormError("Choose a recorded answer.");
      body = { answerId };
    }
    setFormError(null);
    setSendError(null);
    setSending(true);
    try {
      const response = await runChecker(body);
      setResult(response);
      if (response.incidentsCreated.length > 0) notifyIncidentsChanged();
    } catch (error) {
      setSendError(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={submit} noValidate>
        <fieldset className="mode-toggle">
          <legend className="eyebrow">What should CIRQO check?</legend>
          <label className="check">
            <input type="radio" name="mode" checked={mode === "paste"} onChange={() => setMode("paste")} />
            An answer an assistant gave (paste it)
          </label>
          <label className="check">
            <input type="radio" name="mode" checked={mode === "recorded"} onChange={() => setMode("recorded")} />
            An answer CIRQO already recorded
          </label>
        </fieldset>

        {mode === "paste" ? (
          <>
            <label className="field">
              Shopper&apos;s question
              <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="best laptops under $500" />
            </label>
            <label className="field">
              AI assistant
              {summary.loading && <Loading what="assistants" />}
              {summary.error !== undefined && <ErrorNotice error={summary.error} onRetry={summary.reload} />}
              {summary.data && (
                <select value={assistantId} onChange={(e) => setAssistantId(e.target.value)}>
                  <option value="">Choose an assistant</option>
                  {summary.data.byAssistant.map((a) => (
                    <option key={a.assistantId} value={a.assistantId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="field">
              What the assistant said
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={5}
                placeholder="Paste the assistant's answer here."
              />
            </label>
          </>
        ) : (
          <label className="field">
            Recorded answer
            {answers.loading && <Loading what="recorded answers" />}
            {answers.error !== undefined && <ErrorNotice error={answers.error} onRetry={answers.reload} />}
            {answers.data && answers.data.answers.length === 0 && <Empty>No recorded answers yet.</Empty>}
            {answers.data && answers.data.answers.length > 0 && (
              <select value={answerId} onChange={(e) => setAnswerId(e.target.value)}>
                <option value="">Choose an answer</option>
                {answers.data.answers.map((a) => (
                  <option key={a.answerId} value={a.answerId}>
                    {a.assistantName}: “{a.queryText}” ({a.answerId})
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        {formError && (
          <p className="state-error" role="alert">
            {formError}
          </p>
        )}
        <div>
          <button type="submit" className="button" disabled={sending}>
            {sending ? "Checking…" : "Check this answer"}
          </button>
        </div>
      </form>

      {sendError !== null && <ErrorNotice error={sendError} />}
      {result && <CheckerResult result={result} />}
    </div>
  );
}

function CheckerResult({ result }: { result: CheckerRunResponse }) {
  return (
    <section className="card stack" aria-live="polite">
      <div>
        <h2>Checked answer {result.answerId}</h2>
        <p className="muted small">
          {result.claims.length} claim{result.claims.length === 1 ? "" : "s"} found · answer source: {result.source}
        </p>
      </div>
      {result.claims.length === 0 ? (
        <Empty>No factual claims were found in that answer.</Empty>
      ) : (
        <ul className="claim-list">
          {result.claims.map((claim) => (
            <li key={claim.claimId} className="claim-item">
              <div className="pill-row">
                <StatusPill tone={CLAIM_STATUS_TONES[claim.status]}>{CLAIM_STATUS_LABELS[claim.status]}</StatusPill>
                {claim.ruleId && <span className="muted small">{RULE_LABELS[claim.ruleId]}</span>}
              </div>
              <p>“{claim.text}”</p>
              {(claim.extractedValue || claim.verifiedValue) && (
                <p className="small">
                  AI said <strong>{claim.extractedValue ?? "—"}</strong>, verified fact{" "}
                  <strong>{claim.verifiedValue ?? "—"}</strong>
                </p>
              )}
              <p className="muted small">{claim.reason}</p>
            </li>
          ))}
        </ul>
      )}
      {result.incidentsCreated.length > 0 ? (
        <div className="stack-tight">
          <p>
            <strong>{result.incidentsCreated.length}</strong> claim
            {result.incidentsCreated.length === 1 ? " was" : "s were"} opened for review:
          </p>
          <div className="pill-row">
            {result.incidentsCreated.map((id) => (
              <Link key={id} className="button button-secondary" href={`/claims/${encodeURIComponent(id)}`}>
                Open {id}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted small">No new claims needed review.</p>
      )}
    </section>
  );
}
