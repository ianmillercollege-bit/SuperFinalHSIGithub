import type { ReactNode } from 'react';

// Wrap authenticated pages: <AppFrame sidebar={<Sidebar .../>} claims>{page}</AppFrame>
// Pass claims on the three Claims pages for the 4px orange top edge.
export default function AppFrame({ sidebar, children, claims }: { sidebar: ReactNode; children: ReactNode; claims?: boolean }) {
  return (
    <div className="cq-app">
      {sidebar}
      <main className={`cq-main${claims ? ' is-claims' : ''}`}>{children}</main>
    </div>
  );
}
