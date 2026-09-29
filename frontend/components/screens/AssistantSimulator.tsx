"use client";

import { useCallback, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import { ConnectorUnavailableError, connectorQuery, getVisibilitySummary } from "@/lib/api";
import { formatDateTime, formatPercent, formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, CLAIM_STATUS_LABELS } from "@/lib/labels";
import { CLAIM_STATUS_TONES } from "@/lib/tones";
import type { ConnectorResult } from "@/lib/api";
import type { ConnectorMustHave, ConnectorQueryRequest, ConnectorUseCase } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const DEFAULT_QUESTION = "What is the best laptop under $500 for school?";

const USE_CASES: { value: ConnectorUseCase; label: string }[] = [
  { value: "school", label: "School" },
  { value: "work", label: "Work" },
  { value: "travel", label: "Travel" },
  { value: "media", label: "Streaming and media" },
];

const MUST_HAVES: { value: ConnectorMustHave; label: string }[] = [
  { value: "battery", label: "All-day battery" },
  { value: "light", label: "Lightweight" },
  { value: "screen", label: "Big screen" },
  { value: "touch", label: "Touchscreen" },
];

interface Exchange {
  question: string;
  assistantName: string;
  result?: ConnectorResult;
  error?: unknown;
}

/** Shows a judge what an AI assistant gets back from POST /api/v1/connector/query (contract v1.1). */
export default function AssistantSimulator() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [assistantId, setAssistantId] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [useCase, setUseCase] = useState<ConnectorUseCase | "">("");
  const [mustHave, setMustHave] = useState<ConnectorMustHave[]>([]);
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
    setSending(true);
    try {
      const result = await connectorQuery(body);
      setExchanges((list) => [...list, { question: text, assistantName, result }]);
    } catch (error) {
      setExchanges((list) => [...list, { question: text, assistantName, error }]);
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
          <details>
            <summary>Optional: constraints the assistant passes along</summary>
            <div className="stack constraints">
              <label className="field">
                Max price (USD)
                <input type="number" min={1} inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </label>
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
            </div>
          </details>
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
  if (error instanceof ConnectorUnavailableError) {
    return (
      <div className="bubble bubble-coach state-error" role="alert">
        <p>
          The connector isn&apos;t available yet: the backend hasn&apos;t shipped POST /api/v1/connector/query and
          there is no example file (shared/mock/connector_query.json) to show instead. It will work as soon as
          either one lands.
        </p>
      </div>
    );
  }
  return <ErrorNotice error={error} />;
}

function ConnectorReply({ result }: { result: ConnectorResult }) {
  const { response, via } = result;
  const r = response.recommendation;
  return (
    <div className="stack-tight">
      {via === "mock" && (
        <p className="mock-note" role="note">
          <span className="estimate-badge">Mock data</span> The live connector hasn&apos;t shipped yet, so this is the
          example answer from shared/mock/connector_query.json, not a reply to your exact question.
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
          Recorded as answer {response.answerId} · verified {formatDateTime(response.verifiedAt)} · source {response.source}
        </p>
      </div>
    </div>
  );
}
