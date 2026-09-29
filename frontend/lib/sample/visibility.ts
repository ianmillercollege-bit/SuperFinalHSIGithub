// Which tracked shopper prompts the business appeared in, per AI assistant.
// This grid is the raw data behind the Visibility Score, recommendation counts,
// weaknesses, and the business's market share. Edit it here only.
import type { Assistant, TrackedPrompt } from "../schema";
import type { RuleId } from "../types";

export const assistants: Assistant[] = [
  { assistantId: "ast_a", name: "Assistant A" },
  { assistantId: "ast_b", name: "Assistant B" },
  { assistantId: "ast_c", name: "Assistant C" },
  { assistantId: "ast_d", name: "Assistant D" },
];

export const prompts: TrackedPrompt[] = [
  { promptId: "p01", text: "Best outdoor gear shop near Asheville" },
  { promptId: "p02", text: "Where to buy hiking boots in Asheville" },
  { promptId: "p03", text: "Local store that rents camping gear" },
  { promptId: "p04", text: "Best rain jacket for Blue Ridge hiking" },
  { promptId: "p05", text: "Independent outdoor store with a good return policy" },
  { promptId: "p06", text: "Where can I get a backpack fitted near me" },
  { promptId: "p07", text: "Who sells trail running shoes in western North Carolina" },
  { promptId: "p08", text: "Store open Sunday for camping supplies in Asheville" },
  { promptId: "p09", text: "Best place to buy a used kayak near Asheville" },
  { promptId: "p10", text: "Outdoor shop with knowledgeable staff for beginners" },
  { promptId: "p11", text: "Where to buy fly fishing gear in Asheville" },
  { promptId: "p12", text: "Gift ideas for a hiker from a local shop" },
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
