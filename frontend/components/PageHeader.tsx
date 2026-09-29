export default function PageHeader({
  eyebrow,
  title,
  intro,
  claims = false,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  /** Claims pages show an orange CLAIMS tag beside the eyebrow. */
  claims?: boolean;
}) {
  return (
    <header className="page-header">
      <div className="eyebrow-row">
        <p className="eyebrow">{eyebrow}</p>
        {claims && <span className="claims-tag">CLAIMS</span>}
      </div>
      <h1>{title}</h1>
      {intro && <p className="muted">{intro}</p>}
    </header>
  );
}
