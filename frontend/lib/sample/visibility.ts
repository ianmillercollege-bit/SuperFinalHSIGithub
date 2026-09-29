// Which tracked shopper prompts the business appeared in, per AI assistant.
// This grid is the raw data behind the Visibility Score, recommendation counts,
// weaknesses, and the business's market share. Edit it here only.
import type { Assistant, ReasonCode, TrackedPrompt } from "../schema";

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
 * A list of reason codes = the business did not appear, for those reasons.
 */
export type Cell = number | ReasonCode[];

export const resultGrid: Record<string, Cell[]> = {
  p01: [1, 1, 2, 1],
  p02: [2, 1, 3, ["MISSING_STRUCTURED_DATA"]],
  p03: [1, ["STOCK_STATUS_UNKNOWN"], 2, ["STOCK_STATUS_UNKNOWN", "OUTDATED_INFO"]],
  p04: [3, 4, ["MISSING_STRUCTURED_DATA", "COMPETITOR_CITED_MORE"], ["COMPETITOR_CITED_MORE"]],
  p05: [["UNCLEAR_POLICY"], 2, ["UNCLEAR_POLICY", "FEW_REVIEWS"], 3],
  p06: [1, 2, 1, 2],
  p07: [2, ["MISSING_STRUCTURED_DATA"], 3, ["MISSING_STRUCTURED_DATA", "FEW_REVIEWS"]],
  p08: [["OUTDATED_INFO"], 1, 3, 2],
  p09: [
    ["STOCK_STATUS_UNKNOWN"],
    ["MISSING_STRUCTURED_DATA", "STOCK_STATUS_UNKNOWN"],
    ["FEW_REVIEWS"],
    ["COMPETITOR_CITED_MORE"],
  ],
  p10: [1, 1, 2, 1],
  p11: [2, ["FEW_REVIEWS"], ["MISSING_STRUCTURED_DATA"], 3],
  p12: [1, 3, ["FEW_REVIEWS", "MISSING_STRUCTURED_DATA"], ["MISSING_STRUCTURED_DATA"]],
};
