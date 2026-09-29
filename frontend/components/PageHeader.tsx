export default function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{intro}</p>
    </header>
  );
}
