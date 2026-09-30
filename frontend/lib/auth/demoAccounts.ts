import { BUSINESS } from "../business";

// Demo logins for the /login page. Source: BACKEND_CONTRACT.md v1.4 section 7c (login) and the seed notes
// after it: "every demo password is `cirqo-demo`" and "the login page prints the demo usernames"
// (DECISIONS.md #33 and #34). The password is a public demo value, never shown on screen: clicking a row only
// fills the masked password field.
//
// Only usernames the contract prints are listed. The contract gives no username for a Viewer, or for the
// Arcton and Novex owners (GET /auth/demo-accounts will return them once the backend ships v1.4), so none is
// invented here.
export const DEMO_PASSWORD = "cirqo-demo";

export interface DemoLogin {
  name: string;
  /** Job title shown on the row. */
  role: string;
  username: string;
  /** "Brand Data Owner" style roles are owners; CIRQO Staff are not tied to a brand (they open on the default brand). */
  staff: boolean;
}

export const DEMO_LOGINS: DemoLogin[] = [
  { name: "Maria Lopez", role: `Brand Data Owner · ${BUSINESS.name}`, username: "maria.lopez@kestrel.example", staff: false },
  { name: "Grace Kim", role: "Trust and Safety Lead · CIRQO Staff", username: "grace.kim@cirqo.example", staff: true },
  { name: "Dev Patel", role: "Product Owner · CIRQO Staff", username: "dev.patel@cirqo.example", staff: true },
];

/**
 * Sample Community Partner logins, used only while the backend has not shipped login (contract v1.6, section 7e).
 * The contract names the three organizations but not their people, and its usernames follow
 * `<first>.<last>@<org-slug>.example`, so these are labeled sample usernames, not the real ones. The real partner
 * usernames come from the backend's login page list once it ships.
 */
export interface CommunityLogin {
  name: string;
  role: string;
  username: string;
  org: { orgId: string; orgName: string };
}

export const COMMUNITY_LOGINS: CommunityLogin[] = [
  { name: "Bexar Valley School District", role: "Community Partner (sample)", username: "sample@bexar-valley-school-district.example", org: { orgId: "org_sample_1", orgName: "Bexar Valley School District" } },
  { name: "Lone Star Veterans Network", role: "Community Partner (sample)", username: "sample@lone-star-veterans-network.example", org: { orgId: "org_sample_2", orgName: "Lone Star Veterans Network" } },
  { name: "Bridgeway Community Tech", role: "Community Partner (sample)", username: "sample@bridgeway-community-tech.example", org: { orgId: "org_sample_3", orgName: "Bridgeway Community Tech" } },
];
