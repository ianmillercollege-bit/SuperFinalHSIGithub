// Who may do what with claims. Pure: role in, yes/no out.
// Owner and Approver can file, add evidence and withdraw; Viewer is read-only.

export type DemoRole = "Owner" | "Approver" | "Viewer";

export type ClaimPermission = "fileClaim" | "addEvidence" | "withdrawClaim";

const ALLOWED: Record<DemoRole, readonly ClaimPermission[]> = {
  Owner: ["fileClaim", "addEvidence", "withdrawClaim"],
  Approver: ["fileClaim", "addEvidence", "withdrawClaim"],
  Viewer: [],
};

export function can(role: DemoRole, permission: ClaimPermission): boolean {
  return ALLOWED[role].includes(permission);
}
