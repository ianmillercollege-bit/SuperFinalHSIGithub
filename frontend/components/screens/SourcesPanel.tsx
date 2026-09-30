"use client";

import { useCallback } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import { getSources } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import type { CitationSourceType } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const TYPE_LABEL: Record<CitationSourceType, string> = {
  review_site: "Review site",
  marketplace: "Marketplace",
  brand_site: "Brand site",
  forum: "Forum",
  news: "News",
};

/** "Sources the AI relied on" = GET /sources?days=30. The page's one "Sample data" badge is in the layout bar. */
export default function SourcesPanel() {
  const sources = useApi(useCallback(() => getSources(30), []));

  return (
    <section className="card stack" aria-labelledby="sources-title">
      <div>
        <h2 id="sources-title">Sources the AI relied on</h2>
        <p className="muted small">Pages the assistants cited in the last 30 days, and how often their facts were right.</p>
      </div>
      {sources.loading ? (
        <Loading what="sources" />
      ) : sources.error !== undefined ? (
        <ErrorNotice error={sources.error} onRetry={sources.reload} />
      ) : sources.data!.sources.length === 0 ? (
        <Empty>No sources were cited in the last 30 days.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th>Citations</th>
                <th>Share</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {sources.data!.sources.map((s) => (
                <tr key={s.sourceId}>
                  <td>{s.name}</td>
                  <td>{TYPE_LABEL[s.type] ?? s.type}</td>
                  <td>{s.citationCount.toLocaleString("en-US")}</td>
                  <td>{formatPercent(s.citationShare)}</td>
                  <td>{formatPercent(s.accuracyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
