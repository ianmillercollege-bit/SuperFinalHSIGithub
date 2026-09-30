// Canonical sidebar navigation: four groups, in this order, with these labels (Monitor, Grow, Setup, Claims).
// Only the routes are yours: pass the href of each existing page. Never add "Soon" or dead items.
import type { NavGroup } from '../components/dashboard/Sidebar';

export interface NavRoutes {
  dashboard: string; visibility: string; market: string; company: string; products: string;   // Monitor
  companies?: string;                                                                           // Monitor, CIRQO Staff only
  gaps: string; simulator: string; coach: string; preview: string;                              // Grow
  connect: string;                                                                              // Setup
  fileClaim: string; outstanding: string; reviewed: string;                                     // Claims
}

// outstandingCount: the number shown on "Outstanding Claims" (omit or pass undefined for no badge).
// staff: true adds "All companies" (the cross-company view only CIRQO Staff may open).
export function buildNavGroups(r: NavRoutes, outstandingCount?: number, staff = false): NavGroup[] {
  return [
    { title: 'Monitor', items: [
      { label: 'Dashboard', href: r.dashboard },
      { label: 'AI Visibility', href: r.visibility },
      { label: 'Market Position', href: r.market },
      { label: 'Company', href: r.company },
      { label: 'Products', href: r.products },
      ...(staff && r.companies ? [{ label: 'All companies', href: r.companies }] : []),
    ] },
    { title: 'Grow', items: [
      { label: 'Opportunity Gaps', href: r.gaps },
      { label: 'Growth Simulator', href: r.simulator },
      { label: 'AI Coach', href: r.coach },
      { label: 'Preview as shopper', href: r.preview },
    ] },
    { title: 'Setup', items: [{ label: 'Connect your catalog', href: r.connect }] },
    { title: 'Claims', tone: 'claims', items: [
      { label: 'File a Claim', href: r.fileClaim },
      { label: 'Outstanding Claims', href: r.outstanding, ...(outstandingCount !== undefined ? { badge: outstandingCount } : {}) },
      { label: 'Claims Reviewed', href: r.reviewed },
    ] },
  ];
}
