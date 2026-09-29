// Sample-only demo accounts for Harbor Home Goods. There is no login or user
// system in the contract (NEEDS LEAD DECISION in INTEGRATION.md); these give the
// claims permissions something to check against.
import type { DemoRole } from "../claims/permissions";

export interface DemoAccount {
  id: string;
  name: string;
  role: DemoRole;
}

export const demoAccounts: DemoAccount[] = [
  { id: "acct_owner", name: "Dana Ruiz", role: "Owner" },
  { id: "acct_approver", name: "Sam Okafor", role: "Approver" },
  { id: "acct_viewer", name: "Riley Chen", role: "Viewer" },
];

export function demoAccount(role: DemoRole): DemoAccount {
  return demoAccounts.find((a) => a.role === role)!;
}
