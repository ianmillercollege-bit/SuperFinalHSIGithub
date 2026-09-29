import { formatPercent, formatUsd } from "@/lib/format";
import type { SimulationResult, SimulatorAssumptions } from "@/lib/schema";

function formatValue(value: number, unit: "count" | "rate" | "usd"): string {
  if (unit === "rate") return formatPercent(value);
  if (unit === "usd") return `$${value.toFixed(2)}`;
  return value.toLocaleString("en-US");
}

/** Any revenue number in the app is shown through this, labeled and with its assumptions (DECISIONS.md #12). */
export default function RevenueEstimate({
  result,
  assumptions,
}: {
  result: SimulationResult;
  assumptions: SimulatorAssumptions;
}) {
  return (
    <section className="card stack">
      <div className="pill-row">
        <h2>Revenue potential</h2>
        <span className="estimate-badge">Illustrative estimate</span>
      </div>
      <p className="big-number">+{formatUsd(result.revenueDeltaPerMonth)} / month</p>
      <p className="muted">
        If every improvement is fully done, the AI Visibility Score goes from {result.visibilityBefore} to{" "}
        {result.visibilityAfter}. Each point is estimated at {formatUsd(assumptions.revenuePerVisibilityPoint)} a month.
      </p>
      <div>
        <p className="eyebrow">Assumptions behind this estimate</p>
        <ul className="assumptions">
          {assumptions.explanation.map((a) => (
            <li key={a.label}>
              <strong>{a.label}:</strong> {formatValue(a.value, a.unit)}. <span className="muted">{a.explanation}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="muted small">Simulated from sample data. Not a forecast.</p>
    </section>
  );
}
