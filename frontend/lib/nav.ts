// The single navigation definition. The sidebar renders exactly this.

export type NavItem =
  | { label: string; href: string; count?: "outstandingClaims" }
  | { label: string; soon: true };

export interface NavGroup {
  title: string;
  /** "claims" renders as the solid orange block. */
  tone: "default" | "claims";
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Insights",
    tone: "default",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "AI Visibility", soon: true },
      { label: "Market Position", soon: true },
      { label: "Opportunity Gaps", href: "/opportunities" },
      { label: "Growth Simulator", href: "/simulator" },
      { label: "AI Coach", href: "/coach" },
    ],
  },
  {
    title: "Claims",
    tone: "claims",
    items: [
      { label: "File a Claim", href: "/claims/new" },
      // Count badge is wired in a later step; nothing is shown until then.
      { label: "Outstanding Claims", href: "/claims/outstanding", count: "outstandingClaims" },
      { label: "Claims Reviewed", href: "/claims/reviewed" },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
