// Which tracked shopper prompts the business appeared in, per AI assistant.
// This grid is the raw data behind the Visibility Score, recommendation counts,
// weaknesses, and the business's market share. Edit it here only.
import type { Assistant, TrackedPrompt } from "../schema";
import type { RuleId } from "../types";
import { BUSINESS } from "../business";

export const assistants: Assistant[] = [
  { assistantId: "ast_a", name: "Assistant A" },
  { assistantId: "ast_b", name: "Assistant B" },
  { assistantId: "ast_c", name: "Assistant C" },
  { assistantId: "ast_d", name: "Assistant D" },
];

export const prompts: TrackedPrompt[] = [
  { promptId: "p01", text: "Best laptop under $500 for school" },
  { promptId: "p02", text: "Lightweight laptop for travel" },
  { promptId: "p03", text: `Is the ${BUSINESS.name} Aero 14 in stock` },
  { promptId: "p04", text: "Laptop with the best battery life under $600" },
  { promptId: "p05", text: "Laptop brands with an easy return policy" },
  { promptId: "p06", text: "Best 14-inch laptop for college" },
  { promptId: "p07", text: "Which budget laptop has 16 GB of RAM" },
  { promptId: "p08", text: "Cheapest laptop that is actually in stock this week" },
  { promptId: "p09", text: "Refurbished laptop with a warranty" },
  { promptId: "p10", text: "Good first laptop for a high school student" },
  { promptId: "p11", text: "Touchscreen laptop for note-taking" },
  { promptId: "p12", text: "Laptop gift for a student under $500" },
];

/**
 * One row per prompt, one cell per assistant (A, B, C, D in the order above).
 * A number = the business appeared at that rank (1 = named first).
 * A list of ruleIds (from BACKEND_CONTRACT.md) = the business did not appear, for those reasons.
 */
export type Cell = number | RuleId[];

export const resultGrid: Record<string, Cell[]> = {
  p01: [1, 1, 2, 1],
  p02: [2, 1, 3, ["NO_FACT"]],
  p03: [1, ["AVAILABILITY_MISMATCH"], 2, ["AVAILABILITY_MISMATCH", "PRICE_OUTDATED"]],
  p04: [3, 4, ["NO_FACT", "UNFAIR_COMPARISON"], ["UNFAIR_COMPARISON"]],
  p05: [["POLICY_MISMATCH"], 2, ["POLICY_MISMATCH", "SPEC_MISMATCH"], 3],
  p06: [1, 2, 1, 2],
  p07: [2, ["NO_FACT"], 3, ["NO_FACT", "SPEC_MISMATCH"]],
  p08: [["PRICE_OUTDATED"], 1, 3, 2],
  p09: [
    ["AVAILABILITY_MISMATCH"],
    ["NO_FACT", "AVAILABILITY_MISMATCH"],
    ["SPEC_MISMATCH"],
    ["UNFAIR_COMPARISON"],
  ],
  p10: [1, 1, 2, 1],
  p11: [2, ["SPEC_MISMATCH"], ["NO_FACT"], 3],
  p12: [1, 3, ["SPEC_MISMATCH", "NO_FACT"], ["NO_FACT"]],
};
