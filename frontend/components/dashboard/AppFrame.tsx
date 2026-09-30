'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

// Wrap authenticated pages: <AppFrame sidebar={<Sidebar .../>} claims>{page}</AppFrame>
// Pass claims on the three Claims pages for the 4px orange top edge.
// Above 900px the sidebar is fixed on the left. At 900px and below it becomes a menu behind a top bar.
export default function AppFrame({ sidebar, children, claims }: { sidebar: ReactNode; children: ReactNode; claims?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);                       // close after navigating
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [open]);
  return (
    <div className="cq-app" data-nav={open ? 'open' : 'closed'}>
      <div className="cq-topbar">
        <button type="button" className="cq-menubtn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="cq-sidebar" onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{open ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}</svg>
        </button>
        <b>CIRQO Analytics</b>
      </div>
      {sidebar}
      <div className="cq-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <main className={`cq-main${claims ? ' is-claims' : ''}`}>{children}</main>
    </div>
  );
}
