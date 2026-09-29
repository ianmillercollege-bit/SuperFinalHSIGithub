// Sample-only signed-in user for the sidebar chip. The contract has no users or
// sign-in (DECISIONS.md #27: the chip is sample-only and labeled).
import { sampleBusiness } from "./sampleBusiness";

export const sampleUser = {
  name: "Demo User",
  role: "Brand Manager",
  business: sampleBusiness.name,
};

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
