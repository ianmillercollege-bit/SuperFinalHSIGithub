"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorNotice } from "@/components/LoadState";
import SourceChip from "@/components/SourceChip";
import StatusPill from "@/components/StatusPill";
import { connectorQuery, getVisibilitySummary } from "@/lib/api";
import { CONNECTOR_MUST_HAVES, CONNECTOR_USE_CASES } from "@/lib/connectorOptions";
import { formatDateTime, formatPercent, formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, CLAIM_STATUS_LABELS } from "@/lib/labels";
import { CLAIM_STATUS_TONES } from "@/lib/tones";
import type { ConnectorResult } from "@/lib/api";
import type { ConnectorMustHave, ConnectorQueryRequest, ConnectorUseCase } from "@/lib/types";
import { useApi } from "@/lib/useApi";

// Defaults match the pre-filled question. The contract's example uses the "school" use case.
// The contract sets no maximum length for `question`, so the box has none either.
const DEFAULT_QUESTION = "What is the best laptop under $500 for school?";
const DEFAULT_USE_CASE: ConnectorUseCase | "" = "school";
const DEFAULT_MUST_HAVE: ConnectorMustHave[] = [];

const SLOW_AFTER_MS = 4000;

interface Exchange {
  id: number;
  body: ConnectorQueryRequest;
  assistantName: string;
  status: "pending" | "done" | "error";
  slow: boolean;
  result?: ConnectorResult;
  error?: unknown;
}

/** What an AI assistant gets back from POST /api/v1/connector/query (contract v1.1), as a chat. */
export default function AssistantSimulator() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [assistantId, setAssistantId] = useState("");
  const [useCase, setUseCase] = useState<ConnectorUseCase | "">(DEFAULT_USE_CASE);
  const [mustHave, setMustHave] = useState<ConnectorMustHave[]>(DEFAULT_MUST_HAVE);
  const [maxPrice, setMaxPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);
  const nextId = useRef(1);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView?.({ block: "nearest" });
  }, [history]);

  if (summary.loading) return <p className="state" role="status">Loading assistants… If the backend was asleep, this can take up to a minute.</p>;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  const assistants = summary.data!.byAssistant;
  const chosen = assistantId || assistants[0]?.assistantId || "";
  const busy = history.some((x) => x.status === "pending");

  const patch = (id: number, change: Partial<Exchange>) =>
    setHistory((list) => list.map((x) => (x.id === id ? { ...x, ...change } : x)));

  async function run(id: number, body: ConnectorQueryRequest) {
    const timer = setTimeout(() => patch(id, { slow: true }), SLOW_AFTER_MS);
    try {
      const result = await connectorQuery(body);
      patch(id, { status: "done", result, error: undefined });
    } catch (error) {
      patch(id, { status: "error", error });
    } finally {
      clearTimeout(timer);
    }
  }

  function send() {
    if (busy) return;
    const text = question.trim();
    if (!text) return setFormError("Type a shopper question.");
    if (!chosen) return setFormError("Choose an assistant.");
    const price = maxPrice.trim() === "" ? undefined : Number(maxPrice);
    if (price !== undefined && !(price > 0)) return setFormError("Max price must be more than 0.");
    setFormError(null);
    const constraints: NonNullable<ConnectorQueryRequest["constraints"]> = {
      ...(price !== undefined ? { maxPrice: price } : {}),
      ...(useCase ? { useCase } : {}),
      ...(mustHave.length ? { mustHave } : {}),
    };
    const body: ConnectorQueryRequest = {
      question: text,
      assistantId: chosen,
      ...(Object.keys(constraints).length ? { constraints } : {}),
    };
    const id = nextId.current++;
    const assistantName = assistants.find((a) => a.assistantId === chosen)?.name ?? chosen;
    setHistory((list) => [...list, { id, body, assistantName, status: "pending", slow: false }]);
    void run(id, body);
  }

  function retry(ex: Exchange) {
    patch(ex.id, { status: "pending", slow: false, error: undefined });
    void run(ex.id, ex.body);
  }

  function reset() {
    setQuestion(DEFAULT_QUESTION);
    setUseCase(DEFAULT_USE_CASE);
    setMustHave(DEFAULT_MUST_HAVE);
    setMaxPrice("");
    setFormError(null);
  }

  return (
    <div className="stack">
      <section className="card stack" aria-labelledby="chat-title">
        <div className="button-row">
          <h2 id="chat-title" className="eyebrow">
            Conversation
          </h2>
          {history.length > 0 && (
            <button type="button" className="button button-secondary" onClick={() => setHistory([])} disabled={busy}>
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="muted">
            A shopper asks an AI assistant a shopping question. Instead of guessing, the assistant calls CIRQO, which
            answers only from verified facts. Send a question below to see exactly what comes back.
          </p>
        ) : (
          <ul className="chat" role="log" aria-live="polite">
            {history.map((ex) => (
              <li key={ex.id} className="stack-tight">
                <div className="bubble bubble-user">
                  <span className="eyebrow">Shopper asks</span>
                  <p>{ex.body.question}</p>
                  <ul className="chip-row" aria-label="Sent with this question">
                    <li className="source-chip">Assistant: {ex.assistantName}</li>
                    {ex.body.constraints?.useCase && (
                      <li className="source-chip">Use case: {label(CONNECTOR_USE_CASES, ex.body.constraints.useCase)}</li>
                    )}
                    {ex.body.constraints?.mustHave?.map((m) => (
                      <li key={m} className="source-chip">
                        Must have: {label(CONNECTOR_MUST_HAVES, m)}
                      </li>
                    ))}
                    {ex.body.constraints?.maxPrice !== undefined && (
                      <li className="source-chip">Max price: {formatPrice(ex.body.constraints.maxPrice)}</li>
                    )}
                    {!ex.body.constraints && <li className="source-chip">No constraints</li>}
                  </ul>
                </div>
                {ex.status === "pending" && (
                  <div className="bubble bubble-coach" role="status">
                    <p>{ex.slow ? "Waking up the backend… the first request can take up to a minute." : "CIRQO is checking verified facts…"}</p>
                  </div>
                )}
                {ex.status === "error" && <ErrorNotice error={ex.error} onRetry={() => retry(ex)} />}
                {ex.status === "done" && ex.result && <Reply result={ex.result} />}
              </li>
            ))}
          </ul>
        )}
        <div ref={logEnd} />

        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          noValidate
        >
          <label className="field">
            Shopper question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              aria-describedby="enter-hint"
            />
          </label>
          <p id="enter-hint" className="muted small">
            Press Enter to send, Shift+Enter for a new line.
          </p>
          <label className="field">
            AI assistant
            <select value={chosen} onChange={(e) => setAssistantId(e.target.value)}>
              {assistants.map((a) => (
                <option key={a.assistantId} value={a.assistantId}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="constraints-box">
            <legend className="eyebrow">Constraints</legend>
            <div className="constraints-grid">
              <label className="field">
                Use case
                <select value={useCase} onChange={(e) => setUseCase(e.target.value as ConnectorUseCase | "")}>
                  <option value="">Any</option>
                  {CONNECTOR_USE_CASES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="mode-toggle">
              <legend className="small">Must have</legend>
              {CONNECTOR_MUST_HAVES.map((m) => (
                <label key={m.value} className="check">
                  <input
                    type="checkbox"
                    checked={mustHave.includes(m.value)}
                    onChange={(e) =>
                      setMustHave((list) => (e.target.checked ? [...list, m.value] : list.filter((v) => v !== m.value)))
                    }
                  />
                  {m.label}
                </label>
              ))}
            </fieldset>
            <details>
              <summary>More constraints</summary>
              <label className="field">
                Max price (USD)
                <input
                  type="number"
                  min={1}
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Optional. Otherwise taken from the question"
                />
              </label>
            </details>
          </fieldset>

          {formError && (
            <p className="state-error" role="alert">
              {formError}
            </p>
          )}
          <div className="button-row">
            <button type="submit" className="button" disabled={busy}>
              {busy ? "Sending…" : "Send"}
            </button>
            <button type="button" className="link-button" onClick={reset}>
              Reset
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function label<T extends string>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function Reply({ result }: { result: ConnectorResult }) {
  const { response, via } = result;
  const r = response.recommendation;
  const failedFacts = r ? r.facts.filter((f) => f.claimStatus !== "correct") : [];
  return (
    <div className="stack-tight">
      {via === "mock" && (
        <p className="mock-note" role="note">
          <span className="estimate-badge">Mock data</span> Mock mode is on, so this is the example answer from
          shared/mock/connector_query.json, not a reply to your exact question.
        </p>
      )}
      <div className="bubble bubble-coach">
        <span className="eyebrow">Verified answer, from CIRQO</span>
        <p>{response.answerText}</p>
      </div>

      <div className="card stack connector-card">
        {r ? (
          <>
            <div className="rec-head">
              <div>
                <h3>{r.name}</h3>
                <p className="muted">{r.brandName}</p>
              </div>
              <div className="rec-price">
                <span className="big-number">{formatPrice(r.price)}</span>
                <span className="muted">{AVAILABILITY_LABELS[r.availability]}</span>
              </div>
            </div>
            <p className="small">
              Match {formatPercent(r.matchScore)} · {r.returnPolicyDays}-day returns · facts verified{" "}
              {formatDateTime(r.verifiedAt)}
            </p>
            <div>
              <p className="eyebrow">Facts</p>
              <ul className="reason-list">
                {r.facts.map((f) => (
                  <li key={`${f.factId}-${f.text}`}>
                    {f.claimStatus === "correct" ? (
                      <StatusPill tone={CLAIM_STATUS_TONES.correct}>✓ Checked</StatusPill>
                    ) : (
                      <StatusPill tone={CLAIM_STATUS_TONES[f.claimStatus]}>✕ Failed check: {CLAIM_STATUS_LABELS[f.claimStatus]}</StatusPill>
                    )}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
              {failedFacts.length > 0 && (
                <p className="state-error small" role="alert">
                  {failedFacts.length} fact(s) did not pass the check and should not be repeated to the shopper.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="stack-tight" role="note">
            <p>{response.answerText}</p>
            <p>
              <strong>No verified product matches these constraints. Try removing one.</strong>
            </p>
          </div>
        )}

        {response.alternatives.length > 0 && (
          <div>
            <p className="eyebrow">Alternatives</p>
            <ul className="alt-list">
              {response.alternatives.map((a) => (
                <li key={a.productId}>
                  <span>
                    <strong>{a.name}</strong> <span className="muted">{a.brandName}</span>
                  </span>
                  <span>
                    {formatPrice(a.price)} · {formatPercent(a.matchScore)} match
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {response.claims.length > 0 && (
          <details>
            <summary>Every sentence of the answer, checked ({response.claims.length})</summary>
            <ul className="reason-list">
              {response.claims.map((c) => (
                <li key={c.claimId}>
                  {c.status === "correct" ? (
                    <StatusPill tone={CLAIM_STATUS_TONES.correct}>✓ Checked</StatusPill>
                  ) : (
                    <StatusPill tone={CLAIM_STATUS_TONES[c.status]}>✕ Failed check: {CLAIM_STATUS_LABELS[c.status]}</StatusPill>
                  )}
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="neutral-note">{response.rankingNote}</p>
        <ul className="chip-row" aria-label="About this answer">
          <li>
            <SourceChip source={response.source} />
          </li>
          <li className="source-chip">Recorded as {response.answerId}</li>
          <li className="source-chip">Verified {formatDateTime(response.verifiedAt)}</li>
        </ul>
        <p className="muted small">
          Your question and constraints went through the CIRQO connector, and every fact was checked against verified
          product data.
        </p>
      </div>
    </div>
  );
}
