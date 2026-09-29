// Sample-only signed-in user for the sidebar chip. The contract has no users or
// sign-in (NEEDS LEAD DECISION in INTEGRATION.md). Business is the seeded
// client brand from BACKEND_CONTRACT.md section 9.
export const sampleUser = {
  name: "Demo User",
  role: "Brand Manager",
  business: "Kestrel",
};

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
