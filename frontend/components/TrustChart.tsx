"use client";

import { useState } from "react";
import { formatDay, formatPercent } from "@/lib/format";
import type { TrustDaily } from "@/lib/types";

const W = 640;
const H = 240;
const PAD = { left: 44, right: 12, top: 12, bottom: 28 };

type SeriesKey = "accuracyRate" | "hallucinationRate" | "visibilityRate";

const SERIES: { key: SeriesKey; label: string; className: string }[] = [
  { key: "accuracyRate", label: "Accuracy", className: "line-accuracy" },
  { key: "hallucinationRate", label: "Hallucination rate", className: "line-hallucination" },
  { key: "visibilityRate", label: "Visibility", className: "line-visibility" },
];

/** Hand-drawn SVG line chart of the contract's daily trust metrics (all 0 to 1). */
export default function TrustChart({ daily }: { daily: TrustDaily[] }) {
  const [shown, setShown] = useState<SeriesKey | "all">("all");
  const visible = SERIES.filter((s) => shown === "all" || s.key === shown);
  const n = daily.length;
  const x = (i: number) => (n === 1 ? W / 2 : PAD.left + (i * (W - PAD.left - PAD.right)) / (n - 1));
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);
  const pathFor = (key: SeriesKey) =>
    daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const first = daily[0];
  const last = daily[n - 1];
  const areaPath = `${pathFor("accuracyRate")} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const tickDays = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, all) => all.indexOf(v) === i);

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Accuracy went from ${formatPercent(first.accuracyRate)} to ${formatPercent(last.accuracyRate)}; hallucination rate from ${formatPercent(first.hallucinationRate)} to ${formatPercent(last.hallucinationRate)}, over ${n} days.`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
              {formatPercent(v)}
            </text>
          </g>
        ))}
        {tickDays.map((i) => (
          <text key={i} className="axis" x={x(i)} y={H - 8} textAnchor="middle">
            {formatDay(daily[i].date)}
          </text>
        ))}
        {visible.some((s) => s.key === "accuracyRate") && <path className="area-accuracy" d={areaPath} />}
        {visible.map((s) => (
          <path key={s.key} className={`line ${s.className}`} d={pathFor(s.key)} />
        ))}
        {daily.map((d, i) => (
          <circle key={d.date} className="point" cx={x(i)} cy={y(d.accuracyRate)} r={2.5}>
            <title>
              {formatDay(d.date)}: accuracy {formatPercent(d.accuracyRate)}, hallucination{" "}
              {formatPercent(d.hallucinationRate)}, visibility {formatPercent(d.visibilityRate)}, {d.claimsChecked} claims
              checked
            </title>
          </circle>
        ))}
      </svg>
      <fieldset className="mode-toggle">
        <legend className="small">Show</legend>
        {[{ key: "all" as const, label: "All three" }, ...SERIES].map((o) => (
          <label key={o.key} className="check">
            <input type="radio" name="trust-series" checked={shown === o.key} onChange={() => setShown(o.key)} />
            {o.label}
          </label>
        ))}
      </fieldset>
      <figcaption className="legend">
        {visible.map((s) => (
          <span key={s.key} className="legend-item">
            <span className={`legend-swatch ${s.className}`} aria-hidden />
            {s.label} {formatPercent(first[s.key])} → {formatPercent(last[s.key])}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
