// DECISIONS.md #12: every screen shows a "Sample data" badge. Rendered once, in the root layout,
// so it sits in the same spot (top of the page, always visible) on every page.
export default function SampleDataBar() {
  return (
    <div className="sample-bar">
      <span
        className="sample-badge"
        title="Everything shown is seeded or simulated demo data, not real customer results."
      >
        Sample data
      </span>
      <span className="muted small">Seeded or simulated demo data, not real customer results.</span>
    </div>
  );
}
