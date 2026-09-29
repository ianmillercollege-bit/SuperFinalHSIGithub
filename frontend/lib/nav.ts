// The single navigation definition. The sidebar renders exactly this.

export interface NavItem {
  label: string;
  href: string;
  /** Shows a live count badge. */
  count?: "openIncidents";
}

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
      { label: "AI Visibility", href: "/visibility" },
      { label: "Market Position", href: "/market" },
      { label: "Assistant Simulator", href: "/assistant" },
    ],
  },
  {
    title: "Claims",
    tone: "claims",
    items: [
      { label: "File a Claim", href: "/claims/new" },
      { label: "Outstanding Claims", href: "/claims/outstanding", count: "openIncidents" },
      { label: "Claims Reviewed", href: "/claims/reviewed" },
    ],
  },
  {
    // Sample-only pages (DECISIONS.md #28): frontend sample data about Kestrel.
    title: "Extras (sample data)",
    tone: "default",
    items: [
      { label: "Growth Simulator", href: "/simulator" },
      { label: "AI Coach", href: "/coach" },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
