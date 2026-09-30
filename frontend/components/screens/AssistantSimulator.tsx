"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import AssistantSimulatorView from "@/components/screens/AssistantSimulatorView";
import type { SimTurn, SimulatorSend } from "@/components/screens/AssistantSimulatorView";
import Dropdown from "@/components/Dropdown";
import { ApiError, connectorQuery, connectorSearch, getVisibilitySummary } from "@/lib/api";
import type { ConnectorResult } from "@/lib/api";
import { PRODUCT_CATEGORIES, categoryLabel } from "@/lib/categories";
import type { ProductCategory } from "@/lib/categories";
import { CONNECTOR_MUST_HAVES, CONNECTOR_USE_CASES } from "@/lib/connectorOptions";
import { describeError } from "@/lib/errors";
import type { ConnectorMustHave, ConnectorQueryRequest, ConnectorSearchRequest, ConnectorSearchResponse, ConnectorUseCase } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const DEFAULT_QUESTION = "What is the best laptop under $500 for school?";
const label = (options: readonly { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value;

// A preview is either the one-pick call (POST /connector/query) or, when a category is chosen, the funnel
// (POST /connector/search, contract v1.4), which returns up to 5 options and questions to narrow them.
type Job = { kind: "query"; body: ConnectorQueryRequest } | { kind: "search"; body: ConnectorSearchRequest };

/** What an AI assistant gets back from POST /api/v1/connector/query (contract v1.1), shown in the kit's chat view. */
export default function AssistantSimulator() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const [turns, setTurns] = useState<SimTurn[]>([]);
  const [sending, setSending] = useState(false);
  // The request behind each turn, so Retry can send the same thing again.
  const requests = useRef(new Map<string, Job>());
  const [category, setCategory] = useState<ProductCategory | "">("");
  const nextId = useRef(1);

  if (summary.loading) return <Loading what="assistants" />;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  const assistants = summary.data!.byAssistant.map((a) => ({ value: a.assistantId, label: a.name }));

  const patch = (id: string, change: Partial<SimTurn>) => setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));

  async function run(id: string, job: Job) {
    setSending(true);
    patch(id, { pending: true, error: undefined });
    try {
      patch(id, {
        pending: false,
        answer: job.kind === "query" ? toAnswer(await connectorQuery(job.body)) : searchToAnswer(await connectorSearch(job.body)),
      });
    } catch (error) {
      const notShipped = job.kind === "search" && error instanceof ApiError && error.code === "NOT_FOUND";
      patch(id, {
        pending: false,
        error: notShipped ? "The category search isn't available on the backend yet. Choose All categories for a single pick." : describeError(error),
      });
    } finally {
      setSending(false);
    }
  }

  function send(v: SimulatorSend) {
    const id = `turn_${nextId.current++}`;
    if (category) {
      // Funnel mode: the category is the constraint. Use case and must-haves belong to the laptop one-pick call.
      const job: Job = { kind: "search", body: { question: v.question, assistantId: v.assistant, constraints: { category } } };
      requests.current.set(id, job);
      setTurns((list) => [
        ...list,
        { id, question: v.question, assistant: label(assistants, v.assistant), constraints: [`Category: ${categoryLabel(category)}`], pending: true },
      ]);
      void run(id, job);
      return;
    }
    const constraints: NonNullable<ConnectorQueryRequest["constraints"]> = {
      ...(v.useCase ? { useCase: v.useCase as ConnectorUseCase } : {}),
      ...(v.mustHave.length ? { mustHave: v.mustHave as ConnectorMustHave[] } : {}),
    };
    const request: ConnectorQueryRequest = {
      question: v.question,
      assistantId: v.assistant,
      ...(Object.keys(constraints).length ? { constraints } : {}),
    };
    requests.current.set(id, { kind: "query", body: request });
    setTurns((list) => [
      ...list,
      {
        id,
        question: v.question,
        assistant: label(assistants, v.assistant),
        constraints: [
          ...(v.useCase ? [`Use case: ${label(CONNECTOR_USE_CASES, v.useCase)}`] : []),
          ...v.mustHave.map((m) => `Must have: ${label(CONNECTOR_MUST_HAVES, m)}`),
        ],
        pending: true,
      },
    ]);
    void run(id, { kind: "query", body: request });
  }

  return (
    <AssistantSimulatorView
      defaultQuestion={DEFAULT_QUESTION}
      assistants={assistants}
      useCases={[...CONNECTOR_USE_CASES]}
      mustHaves={[...CONNECTOR_MUST_HAVES]}
      defaultUseCase="school"
      title="Preview as shopper"
      eyebrow="What a shopper's AI assistant answers from your verified catalog"
      intro={
        <div className="stack-tight">
        <p className="cq-line">
          Check a launch, see why a competitor wins a question, or reproduce a complaint. Shoppers never see this page. Every preview is
          recorded and appears in <Link className="link" href="/visibility">AI Visibility</Link>.
        </p>
        <div style={{ maxWidth: 320 }}>
          <Dropdown
            label="Category"
            compact
            value={category}
            onChange={(v) => setCategory(v as ProductCategory | "")}
            options={[{ value: "", label: "All categories (one pick)" }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: `${c.label} (options)` }))]}
          />
          <p className="cq-sub">Pick a category to see up to five options and the questions that would narrow them.</p>
        </div>
        </div>
      }
      turns={turns}
      sending={sending}
      onSend={send}
      onClear={() => setTurns([])}
      onRetry={(id) => {
        const job = requests.current.get(id);
        if (job) void run(id, job);
      }}
    />
  );
}

/**
 * Maps the contract's response to the view. The contract returns only `correct` facts, so every fact shows as
 * Checked (anything else would show as Not verified). It has no "matched" or "unmet" constraint fields, so
 * none are shown.
 */
function toAnswer({ response, via }: ConnectorResult): NonNullable<SimTurn["answer"]> {
  const r = response.recommendation;
  return {
    text: response.answerText,
    facts: (r?.facts ?? []).map((f) => ({ text: f.text, status: f.claimStatus === "correct" ? "checked" : "failed" })),
    noMatchMessage: r ? undefined : "No product fits.",
    source: via === "mock" ? `${response.source} (example data: mock mode is on)` : response.source,
  };
}

/** Maps the funnel response: the options and narrowing questions become the answer text; the best option's facts are checked. */
function searchToAnswer(r: ConnectorSearchResponse): NonNullable<SimTurn["answer"]> {
  if (r.optionCount === 0 || r.options.length === 0) {
    return { text: `No verified ${categoryLabel(r.category)} option matches this question.`, facts: [], noMatchMessage: "No product fits.", source: r.source };
  }
  const options = r.options.map((o, i) => `${i + 1}. ${o.name} (${o.brandName}, $${o.price.toFixed(2)})`).join("  ");
  const hints = r.narrowingHints.map((h) => `Ask the shopper: ${h.question}`).join("  ");
  return {
    text: `${r.optionCount} verified ${categoryLabel(r.category)} option${r.optionCount === 1 ? "" : "s"}, best first: ${options}${hints ? `  ${hints}` : ""}`,
    facts: r.options[0].facts.map((f) => ({ text: `${r.options[0].name}: ${f.text}`, status: f.claimStatus === "correct" ? "checked" : "failed" })),
    source: r.source,
  };
}
