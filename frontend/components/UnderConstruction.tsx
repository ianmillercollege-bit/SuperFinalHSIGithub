export default function UnderConstruction({
  title,
  plannedData = [],
}: {
  title: string;
  /** Contract endpoints this page will use, shown until the real screen is built. */
  plannedData?: string[];
}) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p className="note">Under construction. Real screens start when shared/mock/ is ready.</p>
      {plannedData.length > 0 && (
        <>
          <h2 className="planned-title">Data this page will use</h2>
          <ul className="planned">
            {plannedData.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
