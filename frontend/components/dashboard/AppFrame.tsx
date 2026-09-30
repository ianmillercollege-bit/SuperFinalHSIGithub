import type { ReactNode } from 'react';

// Wrap authenticated pages: <AppFrame sidebar={<Sidebar .../>}>{page}</AppFrame>
export default function AppFrame({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="cq-app">
      {sidebar}
      <main className="cq-main">{children}</main>
    </div>
  );
}
