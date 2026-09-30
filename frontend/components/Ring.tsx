// A percentage wheel: an SVG ring filled to `value` (0 to 1) with the percentage in the middle.
// The number is always printed, so the colour never carries the meaning on its own.
const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function Ring({
  value,
  label,
  note,
  color,
  digits = 0,
  display,
}: {
  /** 0 to 1 */
  value: number;
  label: string;
  note: string;
  /** A CSS colour from the design tokens, for example "var(--good)". */
  color: string;
  digits?: number;
  /** Text in the middle, when it should differ from the percentage (for example "54"). */
  display?: string;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = `${(clamped * 100).toFixed(digits)}%`;
  return (
    <div className="card ring-card">
      <svg viewBox="0 0 100 100" className="ring" role="img" aria-label={`${label}: ${display ?? percent}`}>
        <circle cx="50" cy="50" r={R} className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r={R}
          className="ring-fill"
          style={{ stroke: color }}
          strokeDasharray={`${CIRCUMFERENCE * clamped} ${CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle" className="ring-value">
          {display ?? percent}
        </text>
      </svg>
      <div className="ring-text">
        <p className="ring-label">{label}</p>
        <p className="muted small">{note}</p>
      </div>
    </div>
  );
}
