// The single navigation definition. The sidebar renders exactly this.

export interface NavItem {
  label: string;
  href: string;
  /** Shows a live count badge. */
  count?: "openIncidents";
  /** Shown only to CIRQO Staff logins (contract v1.4). */
  staffOnly?: boolean;
  /** Shown only to Community Partner logins and CIRQO Staff (contract v1.6). */
  partnerOrStaff?: boolean;
}

export interface NavGroup {
  title: string;
  /** "claims" renders as the solid orange block. */
  tone: "default" | "claims";
  items: NavItem[];
  /** Brand pages: hidden from Community Partner logins, who have no brand (contract v1.6). */
  brandOnly?: boolean;
}

export const NAV: NavGroup[] = [
  {
    title: "Insights",
    tone: "default",
    brandOnly: true,
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "AI Visibility", href: "/visibility" },
      { label: "Market Position", href: "/market" },
      { label: "Company", href: "/company" },
      { label: "Products", href: "/products" },
      { label: "All companies", href: "/companies", staffOnly: true },
      // Sample-only pages allowed by DECISIONS.md #28: frontend sample data about the demo business.
      { label: "Preview as shopper", href: "/preview" },
      { label: "Growth Simulator", href: "/growth-simulator" },
      { label: "AI Coach", href: "/coach" },
    ],
  },
  {
    title: "Setup",
    tone: "default",
    brandOnly: true,
    items: [{ label: "Connect your catalog", href: "/connect" }],
  },
  {
    title: "Claims",
    tone: "claims",
    brandOnly: true,
    items: [
      { label: "File a Claim", href: "/claims/new" },
      { label: "Outstanding Claims", href: "/claims/outstanding", count: "openIncidents" },
      { label: "Claims Reviewed", href: "/claims/reviewed" },
    ],
  },
  {
    title: "Community",
    tone: "default",
    items: [
      { label: "Community catalog", href: "/community", partnerOrStaff: true },
      { label: "Community requests", href: "/community/requests" },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
