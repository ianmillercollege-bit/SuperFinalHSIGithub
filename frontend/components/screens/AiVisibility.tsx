"use client";

import Dropdown from "@/components/Dropdown";
import { useCallback, useState } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import SourceChip from "@/components/SourceChip";
import StatusPill from "@/components/StatusPill";
import { getAnswers, getVisibilitySummary } from "@/lib/api";
import { formatDateTime, formatPercent } from "@/lib/format";
import { useApi } from "@/lib/useApi";

/** AI Visibility = GET /visibility/summary + GET /answers (DECISIONS.md #27). */
export default function AiVisibility() {
  const summary = useApi(useCallback(() => getVisibilitySummary(30), []));
  const [assistantId, setAssistantId] = useState("");
  const answers = useApi(useCallback(() => getAnswers({ assistantId: assistantId || undefined, limit: 50 }), [assistantId]));

  return (
    <div className="stack">
      {summary.loading && <Loading what="visibility summary" />}
      {summary.error !== undefined && <ErrorNotice error={summary.error} onRetry={summary.reload} />}
      {summary.data && (
        <>
          <div className="stat-grid">
            <div className="card stat">
              <p className="eyebrow">AI Visibility Score</p>
              {/* DECISIONS.md #13: round(visibilityRate x 100) */}
              <p className="big-number">{Math.round(summary.data.visibilityRate * 100)}/100</p>
              <p className="muted small">Share of tracked answers naming {summary.data.brandName}</p>
            </div>
            <div className="card stat">
              <p className="eyebrow">Average rank</p>
              <p className="big-number">#{summary.data.averageRank.toFixed(1)}</p>
              <p className="muted small">Position when mentioned (1 = first)</p>
            </div>
            <div className="card stat">
              <p className="eyebrow">Share of voice</p>
              <p className="big-number">{formatPercent(summary.data.shareOfVoice)}</p>
              <p className="muted small">Of all brand mentions</p>
            </div>
          </div>

          <section className="card stack">
            <h2>By assistant</h2>
            {summary.data.byAssistant.length === 0 ? (
              <Empty>No assistants tracked yet.</Empty>
            ) : (
              <ul className="bar-list">
                {summary.data.byAssistant.map((a) => (
                  <li key={a.assistantId}>
                    <div className="bar-label">
                      <span>{a.name}</span>
                      <span className="muted small">
                        {formatPercent(a.visibilityRate)} · avg rank #{a.averageRank.toFixed(1)}
                      </span>
                    </div>
                    <div className="bar-track" aria-hidden>
                      <div className="bar-fill" style={{ width: `${Math.round(a.visibilityRate * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Last {summary.data.periodDays} days.</p>
          </section>
        </>
      )}

      <section className="card stack">
        <div className="filters">
          <h2 className="grow">
            Recent AI answers{" "}
            {answers.data?.answers[0] && <SourceChip source={answers.data.answers[0].source} />}
          </h2>
          <Dropdown
            label="Assistant"
            compact
            value={assistantId}
            onChange={setAssistantId}
            options={[{ value: "", label: "All assistants" }, ...(summary.data?.byAssistant ?? []).map((a) => ({ value: a.assistantId, label: a.name }))]}
          />
        </div>
        {answers.loading && <Loading what="answers" />}
        {answers.error !== undefined && <ErrorNotice error={answers.error} onRetry={answers.reload} />}
        {answers.data && answers.data.answers.length === 0 && <Empty>No answers recorded for this assistant yet.</Empty>}
        {answers.data && answers.data.answers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Assistant</th>
                  <th>Shopper question</th>
                  <th>Mentioned you?</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                {answers.data.answers.map((a) => (
                  <tr key={a.answerId}>
                    <td className="nowrap">{formatDateTime(a.capturedAt)}</td>
                    <td>{a.assistantName}</td>
                    <td>
                      <details>
                        <summary>{a.queryText}</summary>
                        <p className="small answer-text">{a.answerText}</p>
                      </details>
                    </td>
                    <td>
                      <StatusPill tone={a.brandMentioned ? "good" : "neutral"}>
                        {a.brandMentioned ? "Mentioned" : "Not mentioned"}
                      </StatusPill>
                    </td>
                    <td>{a.rank === null ? "—" : `#${a.rank}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
