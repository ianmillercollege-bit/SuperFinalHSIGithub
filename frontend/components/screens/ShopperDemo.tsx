"use client";

import { useCallback, useState } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import StatusPill from "@/components/StatusPill";
import SwipeDeck from "@/components/SwipeDeck";
import { getShopperQuestions, recommend } from "@/lib/api";
import { formatDateTime, formatPercent, formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS, CLAIM_STATUS_LABELS } from "@/lib/labels";
import { CLAIM_STATUS_TONES } from "@/lib/tones";
import type { RecommendRequest, RecommendResponse, ShopperQuestion } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type Swipe = RecommendRequest["swipes"][number];

export default function ShopperDemo() {
  const questions = useApi(useCallback(() => getShopperQuestions(), []));
  const [step, setStep] = useState(-1); // -1 = intro
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);

  if (questions.loading) return <Loading what="shopper questions" />;
  if (questions.error) return <ErrorNotice error={questions.error} onRetry={questions.reload} />;
  const data = questions.data!;
  if (data.questions.length === 0) return <Empty>No shopper questions yet.</Empty>;

  async function submit(finalAnswers: Record<string, string>, finalSwipes: Swipe[]) {
    setSending(true);
    setSendError(null);
    try {
      setResult(
        await recommend({
          answers: Object.entries(finalAnswers).map(([questionId, optionId]) => ({ questionId, optionId })),
          swipes: finalSwipes,
        }),
      );
    } catch (error) {
      setSendError(error);
    } finally {
      setSending(false);
    }
  }

  function advance(nextAnswers: Record<string, string>, nextSwipes: Swipe[]) {
    if (step + 1 < data.questions.length) {
      setStep(step + 1);
    } else {
      void submit(nextAnswers, nextSwipes);
    }
  }

  function restart() {
    setStep(-1);
    setAnswers({});
    setSwipes([]);
    setResult(null);
    setSendError(null);
  }

  if (result) return <RecommendationView result={result} onRestart={restart} />;
  if (sending) return <Loading what="a verified recommendation" />;
  if (sendError) {
    return (
      <div className="stack">
        <ErrorNotice error={sendError} onRetry={() => void submit(answers, swipes)} />
        <button type="button" className="button button-secondary" onClick={restart}>
          Start over
        </button>
      </div>
    );
  }

  if (step === -1) {
    return (
      <section className="card stack">
        <p className="eyebrow">A shopper asks an AI assistant</p>
        <p className="quote">“{data.openingQuery}”</p>
        <p className="muted">
          Answer {data.questions.length} quick questions and FrontDoor finds the best fit, using only verified
          product facts.
        </p>
        <div>
          <button type="button" className="button" onClick={() => setStep(0)}>
            Start
          </button>
        </div>
      </section>
    );
  }

  const question: ShopperQuestion = data.questions[step];
  return (
    <section className="card stack">
      <p className="eyebrow">
        Question {step + 1} of {data.questions.length}
      </p>
      <h2>{question.prompt}</h2>
      {question.type === "swipe" ? (
        <SwipeDeck
          key={question.questionId}
          options={question.options}
          onDone={(decisions) => {
            const nextSwipes = [
              ...swipes.filter((s) => !question.options.some((o) => o.optionId === s.optionId)),
              ...decisions,
            ];
            setSwipes(nextSwipes);
            advance(answers, nextSwipes);
          }}
        />
      ) : (
        <div className="option-grid">
          {question.options.map((option) => (
            <button
              key={option.optionId}
              type="button"
              className={`option ${answers[question.questionId] === option.optionId ? "option-selected" : ""}`}
              onClick={() => {
                const nextAnswers = { ...answers, [question.questionId]: option.optionId };
                setAnswers(nextAnswers);
                advance(nextAnswers, swipes);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div>
        <button type="button" className="button button-secondary" onClick={() => setStep(step - 1)}>
          Back
        </button>
      </div>
    </section>
  );
}

function RecommendationView({ result, onRestart }: { result: RecommendResponse; onRestart: () => void }) {
  const { recommendation, alternatives, rankingNote, source } = result;
  return (
    <div className="stack">
      {recommendation ? (
        <section className="card stack">
          <p className="eyebrow">Best fit</p>
          <div className="rec-head">
            <div>
              <h2>{recommendation.name}</h2>
              <p className="muted">{recommendation.brandName}</p>
            </div>
            <div className="rec-price">
              <span className="big-number">{formatPrice(recommendation.price)}</span>
              <span className="muted">{AVAILABILITY_LABELS[recommendation.availability]}</span>
            </div>
          </div>
          <p>
            Match score: <strong>{formatPercent(recommendation.matchScore)}</strong>
          </p>
          <div>
            <p className="eyebrow">Why it fits (every reason checked against verified facts)</p>
            <ul className="reason-list">
              {recommendation.reasons.map((reason) => (
                <li key={`${reason.factId}-${reason.text}`}>
                  <StatusPill tone={CLAIM_STATUS_TONES[reason.claimStatus]}>
                    {CLAIM_STATUS_LABELS[reason.claimStatus]}
                  </StatusPill>
                  <span>{reason.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="muted small">Facts verified {formatDateTime(recommendation.verifiedAt)}</p>
        </section>
      ) : (
        <section className="card">
          <Empty>No product fits these answers. Try a higher budget or fewer must-haves.</Empty>
        </section>
      )}

      {alternatives.length > 0 && (
        <section className="card stack">
          <p className="eyebrow">Also worth a look</p>
          <ul className="alt-list">
            {alternatives.map((alt) => (
              <li key={alt.productId}>
                <span>
                  <strong>{alt.name}</strong> <span className="muted">{alt.brandName}</span>
                </span>
                <span>
                  {formatPrice(alt.price)} · {formatPercent(alt.matchScore)} match
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="neutral-note">{rankingNote}</p>
      <p className="muted small">Answer source: {source}</p>
      <div>
        <button type="button" className="button" onClick={onRestart}>
          Start over
        </button>
      </div>
    </div>
  );
}
