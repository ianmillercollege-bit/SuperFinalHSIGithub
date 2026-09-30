"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import CheckerView from "@/components/screens/CheckerView";
import type { CheckerResultData, FieldSpec } from "@/components/screens/CheckerView";
import { getAnswers, getIncident, getVisibilitySummary, runChecker } from "@/lib/api";
import { canAct, useUserSession } from "@/lib/auth/userSession";
import { describeError } from "@/lib/errors";
import { notifyIncidentsChanged } from "@/lib/events";
import { INCIDENT_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import type { CheckerRunRequest, CheckerRunResponse, Incident } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const NO_ASSISTANT = "Choose an assistant";
const NO_ANSWER = "None (I will paste an answer)";

/** File a Claim = POST /api/v1/checker/run (DECISIONS.md #27, contract section 7). */
export default function FileClaim() {
  const summary = useApi(useCallback(() => getVisibilitySummary(), []));
  const answers = useApi(useCallback(() => getAnswers({ limit: 50 }), []));
  const params = useSearchParams();
  const session = useUserSession();
  const canFile = canAct(session);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<CheckerResultData | undefined>();
  const [runs, setRuns] = useState(0);

  const assistants = summary.data?.byAssistant ?? [];
  const recorded = useMemo(
    () => (answers.data?.answers ?? []).map((a) => ({ id: a.answerId, label: `${a.answerId} · ${a.assistantName}: ${a.queryText}` })),
    [answers.data],
  );

  // Opened from AI Visibility: ?assistant=<name>&question=<answerId>. Only the shopper's question is quoted, never an AI answer.
  const askedAssistant = assistants.find((a) => a.name === params.get("assistant"))?.name;
  const askedQuestion = answers.data?.answers.find((a) => a.answerId === params.get("question"))?.queryText;

  // The contract's request is either { answerId } or { answerText, assistantId, queryText }; the contract
  // sets no lengths, so no field has a maximum. Which fields are required depends on the form, so onSubmit checks it.
  const fields: FieldSpec[] = [
    { name: "answerText", label: "What the assistant said", type: "textarea", placeholder: "Paste the assistant's answer here." },
    { name: "assistantId", label: "AI assistant", type: "select", options: [NO_ASSISTANT, ...assistants.map((a) => a.name)], defaultValue: askedAssistant, half: true },
    { name: "queryText", label: "Shopper's question", type: "text", placeholder: "best laptops under $500", defaultValue: askedQuestion, half: true },
    ...(recorded.length > 0
      ? [{ name: "answerId", label: "Or check an answer CIRQO already recorded", type: "select" as const, options: [NO_ANSWER, ...recorded.map((r) => r.label)] }]
      : []),
  ];

  async function submit(values: Record<string, string>) {
    const assistant = assistants.find((a) => a.name === values.assistantId);
    const answer = recorded.find((r) => r.label === values.answerId);
    const pasted = Boolean(values.answerText || values.queryText || assistant);
    let body: CheckerRunRequest;
    if (answer) {
      if (pasted) return setError("Use either a recorded answer or a pasted answer, not both.");
      body = { answerId: answer.id };
    } else {
      if (!values.answerText || !values.queryText || !assistant) {
        return setError("Fill in what the assistant said, the assistant, and the shopper's question, or choose a recorded answer.");
      }
      body = { answerText: values.answerText, assistantId: assistant.assistantId, queryText: values.queryText };
    }
    setError(undefined);
    setSending(true);
    try {
      const response = await runChecker(body);
      setResult(await toResult(response));
      if (response.incidentsCreated.length > 0) notifyIncidentsChanged();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSending(false);
    }
  }

  if (summary.loading || answers.loading) return <Loading what="the form" />;
  if (summary.error !== undefined) return <ErrorNotice error={summary.error} onRetry={summary.reload} />;

  return (
    <CheckerView
      key={runs}
      fields={fields}
      onSubmit={(values) => void submit(values)}
      submitting={sending}
      disabled={!canFile}
      disabledNote="Your role can't file claims."
      error={error}
      result={result}
      onReset={() => {
        setResult(undefined);
        setError(undefined);
        setRuns((n) => n + 1);
      }}
      notice={
        answers.error !== undefined
          ? "Recorded answers could not be loaded, so only pasting an answer is available."
          : askedQuestion !== undefined
            ? `From AI Visibility, question: "${askedQuestion}". Paste what the assistant said below.`
            : undefined
      }
      steps={[
        { title: "Claims are extracted", body: "CIRQO finds each factual claim in the answer." },
        { title: "Plain code checks them", body: "Each claim is compared with your verified product facts." },
        { title: "Wrong ones open an incident", body: "Small fixes apply automatically; big ones wait for the named owner on Outstanding Claims." },
      ]}
      renderLink={(href, label) => (
        <Link className="link" href={href}>
          {label}
        </Link>
      )}
    />
  );
}

/** Maps the checker response to the view: each claim's verdict, the incident(s) created, and the source. */
async function toResult(response: CheckerRunResponse): Promise<CheckerResultData> {
  const incidents: Incident[] = await Promise.all(response.incidentsCreated.map((id) => getIncident(id)));
  const unique = (values: string[]) => [...new Set(values)].join(", ");
  return {
    claims: response.claims.map((c) => ({ text: c.text, verdict: c.status, fact: c.verifiedValue ?? undefined })),
    incident:
      incidents.length > 0
        ? {
            id: incidents.map((i) => i.incidentId).join(", "),
            severity: unique(incidents.map((i) => SEVERITY_LABELS[i.severity])),
            state: unique(incidents.map((i) => INCIDENT_STATUS_LABELS[i.status].toLowerCase())),
            // Anything still open (waiting or escalated) is on Outstanding Claims; otherwise it is already decided.
            href: incidents.some((i) => i.status === "pending_approval" || i.status === "escalated") ? "/claims/outstanding" : "/claims/reviewed",
          }
        : undefined,
    sourceLabel: response.source,
  };
}
