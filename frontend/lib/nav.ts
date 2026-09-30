// Canonical sidebar navigation: three groups, in this order, with these labels (Monitor, Grow, Claims).
// Only the routes are yours: pass the href of each existing page. Never add "Soon" or dead items.
import type { NavGroup } from '../components/dashboard/Sidebar';

export interface NavRoutes {
  dashboard: string; visibility: string; market: string;                 // Monitor
  gaps: string; simulator: string; coach: string;                        // Grow
  fileClaim: string; outstanding: string; reviewed: string;              // Claims
}

// outstandingCount: the number shown on "Outstanding Claims" (omit or pass undefined for no badge).
export function buildNavGroups(r: NavRoutes, outstandingCount?: number): NavGroup[] {
  return [
    { title: 'Monitor', items: [{ label: 'Dashboard', href: r.dashboard }, { label: 'AI Visibility', href: r.visibility }, { label: 'Market Position', href: r.market }] },
    { title: 'Grow', items: [{ label: 'Opportunity Gaps', href: r.gaps }, { label: 'Growth Simulator', href: r.simulator }, { label: 'AI Coach', href: r.coach }] },
    { title: 'Claims', tone: 'claims', items: [
      { label: 'File a Claim', href: r.fileClaim },
      { label: 'Outstanding Claims', href: r.outstanding, ...(outstandingCount !== undefined ? { badge: outstandingCount } : {}) },
      { label: 'Claims Reviewed', href: r.reviewed },
    ] },
  ];
}
