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
      // Sample-only pages allowed by DECISIONS.md #28: frontend sample data about the demo business.
      { label: "Assistant Simulator", href: "/assistant-simulator" },
      { label: "Growth Simulator", href: "/growth-simulator" },
      { label: "AI Coach", href: "/coach" },
    ],
  },
  {
    title: "Setup",
    tone: "default",
    items: [{ label: "Connect your catalog", href: "/connect" }],
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
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
