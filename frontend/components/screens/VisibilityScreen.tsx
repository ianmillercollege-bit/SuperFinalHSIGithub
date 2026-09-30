"use client";

import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import SourcesPanel from "@/components/screens/SourcesPanel";
import VisibilityView from "@/components/screens/VisibilityView";
import { getAnswers, getVisibilitySummary } from "@/lib/api";
import { ANSWERS_LIMIT } from "@/lib/dashboard/liveVisibility";
import { liveVisibilityProps } from "@/lib/screens/liveVisibilityMarket";
import { useApi } from "@/lib/useApi";

/** AI Visibility = GET /visibility/summary + GET /answers (DECISIONS.md #27), shown with the kit's VisibilityView. */
export default function VisibilityScreen() {
  const summary = useApi(useCallback(() => getVisibilitySummary(30), []));
  const answers = useApi(useCallback(() => getAnswers({ limit: ANSWERS_LIMIT }), []));

  if (summary.loading || answers.loading) return <Loading what="AI visibility" />;
  const failed = summary.error ?? answers.error;
  if (failed !== undefined) {
    return (
      <ErrorNotice
        error={failed}
        onRetry={() => {
          summary.reload();
          answers.reload();
        }}
      />
    );
  }
  const props = liveVisibilityProps(summary.data!, answers.data!.answers);
  if (props.prompts.length === 0) return <Empty>No question has been answered by every assistant yet.</Empty>;

  return (
    <>
      <VisibilityView
        {...props}
        claimHref={(assistant, id) => `/claims/new?assistant=${encodeURIComponent(assistant)}&question=${encodeURIComponent(id)}`}
      />
      {props.hiddenQuestions > 0 && (
        <p className="muted small">
          {props.hiddenQuestions} more {props.hiddenQuestions === 1 ? "question was" : "questions were"} not shown because not every assistant has answered {props.hiddenQuestions === 1 ? "it" : "them"} yet.
        </p>
      )}
      <SourcesPanel />
    </>
  );
}
