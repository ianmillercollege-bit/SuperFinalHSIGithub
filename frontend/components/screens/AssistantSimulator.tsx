"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import AssistantSimulatorView from "@/components/screens/AssistantSimulatorView";
import type { SimTurn, SimulatorSend } from "@/components/screens/AssistantSimulatorView";
import { connectorQuery, getVisibilitySummary } from "@/lib/api";
import type { ConnectorResult } from "@/lib/api";
import { CONNECTOR_MUST_HAVES, CONNECTOR_USE_CASES } from "@/lib/connectorOptions";
import { describeError } from "@/lib/errors";
import type { ConnectorMustHave, ConnectorQueryRequest, ConnectorUseCase } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const DEFAULT_QUESTION = "What is the best laptop under $500 for school?";
const label = (options: readonly { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value;

/** What an AI assistant gets back from POST /api/v1/connector/query (contract v1.1), shown in the kit's chat view. */
export default function AssistantSimulator() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const [turns, setTurns] = useState<SimTurn[]>([]);
  const [sending, setSending] = useState(false);
  // The request behind each turn, so Retry can send the same thing again.
  const requests = useRef(new Map<string, ConnectorQueryRequest>());
  const nextId = useRef(1);

  if (summary.loading) return <Loading what="assistants" />;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;
  const assistants = summary.data!.byAssistant.map((a) => ({ value: a.assistantId, label: a.name }));

  const patch = (id: string, change: Partial<SimTurn>) => setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));

  async function run(id: string, request: ConnectorQueryRequest) {
    setSending(true);
    patch(id, { pending: true, error: undefined });
    try {
      patch(id, { pending: false, answer: toAnswer(await connectorQuery(request)) });
    } catch (error) {
      patch(id, { pending: false, error: describeError(error) });
    } finally {
      setSending(false);
    }
  }

  function send(v: SimulatorSend) {
    const constraints: NonNullable<ConnectorQueryRequest["constraints"]> = {
      ...(v.useCase ? { useCase: v.useCase as ConnectorUseCase } : {}),
      ...(v.mustHave.length ? { mustHave: v.mustHave as ConnectorMustHave[] } : {}),
    };
    const request: ConnectorQueryRequest = {
      question: v.question,
      assistantId: v.assistant,
      ...(Object.keys(constraints).length ? { constraints } : {}),
    };
    const id = `turn_${nextId.current++}`;
    requests.current.set(id, request);
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
    void run(id, request);
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
        <p className="cq-line">
          Check a launch, see why a competitor wins a question, or reproduce a complaint. Shoppers never see this page. Every preview is
          recorded and appears in <Link className="link" href="/visibility">AI Visibility</Link>.
        </p>
      }
      turns={turns}
      sending={sending}
      onSend={send}
      onClear={() => setTurns([])}
      onRetry={(id) => {
        const request = requests.current.get(id);
        if (request) void run(id, request);
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
