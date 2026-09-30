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
