"use client";

import { useCallback, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { connectorQuery, getVisibilitySummary } from "@/lib/api";
import { CONNECTOR_MUST_HAVES, CONNECTOR_USE_CASES } from "@/lib/connectorOptions";
import { formatDateTime, formatPercent, formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, CLAIM_STATUS_LABELS } from "@/lib/labels";
import { CLAIM_STATUS_TONES } from "@/lib/tones";
import type { ConnectorResult } from "@/lib/api";
import type { ConnectorMustHave, ConnectorQueryRequest, ConnectorUseCase } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const DEFAULT_QUESTION = "What is the best laptop under $500 for school?";

// The contract's `source` field: how the backend composed the answer.
const AI_SOURCE_LABELS: Record<ConnectorResult["response"]["source"], string> = {
  live: "live AI extraction",
  mock: "plain code from verified facts (no AI)",
  fallback: "seeded data (AI unavailable)",
};

const USE_CASES = CONNECTOR_USE_CASES;
const MUST_HAVES = CONNECTOR_MUST_HAVES;

interface Exchange {
  question: string;
  assistantName: string;
  /** Plain-English summary of the constraints that were sent. */
  sent: string;
  result?: ConnectorResult;
  error?: unknown;
}

/** Shows a judge what an AI assistant gets back from POST /api/v1/connector/query (contract v1.1). */
export default function AssistantSimulator() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [assistantId, setAssistantId] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  // Defaults match the pre-filled question. Without constraints the connector just ranks by price.
  const [useCase, setUseCase] = useState<ConnectorUseCase | "">("school");
  const [mustHave, setMustHave] = useState<ConnectorMustHave[]>(["battery", "light"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  if (summary.loading) return <Loading what="assistants" />;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  const assistants = summary.data!.byAssistant;
  const chosen = assistantId || assistants[0]?.assistantId || "";

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return setFormError("Type a shopper question.");
    if (!chosen) return setFormError("Choose an assistant.");
    const price = maxPrice.trim() === "" ? undefined : Number(maxPrice);
    if (price !== undefined && !(price > 0)) return setFormError("Max price must be more than 0.");
    setFormError(null);

    const constraints: ConnectorQueryRequest["constraints"] = {
      ...(price !== undefined ? { maxPrice: price } : {}),
      ...(useCase ? { useCase } : {}),
      ...(mustHave.length ? { mustHave } : {}),
    };
    const body: ConnectorQueryRequest = {
      question: text,
      assistantId: chosen,
      ...(Object.keys(constraints).length ? { constraints } : {}),
    };
    const assistantName = assistants.find((a) => a.assistantId === chosen)?.name ?? chosen;
    const sent = [
      price !== undefined ? `max ${formatPrice(price)}` : "max price from the question",
      useCase ? `for ${USE_CASES.find((u) => u.value === useCase)?.label.toLowerCase()}` : "any use",
      mustHave.length ? `must have ${mustHave.map((m) => MUST_HAVES.find((x) => x.value === m)?.label.toLowerCase()).join(", ")}` : "no must-haves",
    ].join(" · ");
    setSending(true);
    try {
      const result = await connectorQuery(body);
      setExchanges((list) => [...list, { question: text, assistantName, sent, result }]);
    } catch (error) {
      setExchanges((list) => [...list, { question: text, assistantName, sent, error }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        <p className="muted">
          A shopper asks an AI assistant a shopping question. Instead of guessing, the assistant calls CIRQO, which
          answers only from verified facts. This shows exactly what the assistant gets back.
        </p>
        {exchanges.length > 0 && (
          <ul className="chat" aria-live="polite">
            {exchanges.map((ex, i) => (
              <li key={i} className="stack-tight">
                <div className="bubble bubble-user">
                  <span className="eyebrow">Shopper asks {ex.assistantName}</span>
                  <p>{ex.question}</p>
                  <span className="small muted">Constraints sent: {ex.sent}</span>
                </div>
                {ex.result ? <ConnectorReply result={ex.result} /> : <ConnectorError error={ex.error} />}
              </li>
            ))}
          </ul>
        )}
        {sending && <Loading what="CIRQO's verified answer" />}

        <form className="stack" onSubmit={ask} noValidate>
          <label className="field">
            Shopper question
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} />
          </label>
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
            <legend className="eyebrow">What the shopper cares about (sent to CIRQO as constraints)</legend>
            <div className="constraints-grid">
              <label className="field">
                Use case
                <select value={useCase} onChange={(e) => setUseCase(e.target.value as ConnectorUseCase | "")}>
                  <option value="">Any</option>
                  {USE_CASES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Max price (USD, optional)
                <input
                  type="number"
                  min={1}
                  inputMode="decimal"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Taken from the question"
                />
              </label>
            </div>
            <fieldset className="mode-toggle">
                <legend className="small">Must have</legend>
                {MUST_HAVES.map((m) => (
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
          </fieldset>
          {formError && (
            <p className="state-error" role="alert">
              {formError}
            </p>
          )}
          <div>
            <button type="submit" className="button" disabled={sending}>
              {sending ? "Asking…" : "Ask the assistant"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ConnectorError({ error }: { error: unknown }) {
  return <ErrorNotice error={error} />;
}

function ConnectorReply({ result }: { result: ConnectorResult }) {
  const { response, via } = result;
  const r = response.recommendation;
  return (
    <div className="stack-tight">
      {via === "mock" && (
        <p className="mock-note" role="note">
          <span className="estimate-badge">Mock data</span> Mock mode is on, so this is the example answer from
          shared/mock/connector_query.json, not a reply to your exact question.
        </p>
      )}
      <div className="bubble bubble-coach">
        <span className="eyebrow">Assistant answers, from CIRQO</span>
        <p>{response.answerText}</p>
      </div>
      <div className="card stack connector-card">
        <p className="eyebrow">What CIRQO returned to the assistant</p>
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
              <p className="eyebrow">Facts (each one checked)</p>
              <ul className="reason-list">
                {r.facts.map((f) => (
                  <li key={`${f.factId}-${f.text}`}>
                    <StatusPill tone={CLAIM_STATUS_TONES[f.claimStatus]}>✓ Checked: {CLAIM_STATUS_LABELS[f.claimStatus]}</StatusPill>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p>No product fits these constraints, so CIRQO said so instead of guessing.</p>
        )}

        {response.claims.length > 0 && (
          <div>
            <p className="eyebrow">Every sentence of the answer, checked</p>
            <ul className="reason-list">
              {response.claims.map((c) => (
                <li key={c.claimId}>
                  <StatusPill tone={CLAIM_STATUS_TONES[c.status]}>✓ Checked: {CLAIM_STATUS_LABELS[c.status]}</StatusPill>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
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

        <p className="neutral-note">{response.rankingNote}</p>
        <p className="muted small">
          Recorded as answer {response.answerId} · verified {formatDateTime(response.verifiedAt)} · answer written by{" "}
          {AI_SOURCE_LABELS[response.source]}
        </p>
      </div>
    </div>
  );
}
