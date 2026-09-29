// The money side of the what-if simulator. Edit these numbers to change every
// revenue estimate in the app.
//
// revenuePerVisibilityPoint is the one constant the simulator uses. The list
// below explains where it comes from:
//   2,000 queries x 1% per point x 10% conversion x $143.33 order ≈ $286.67 per point.
// If you change the explanation, update the constant to match (npm run check:sample
// verifies they agree within $1).
import type { SimulatorAssumptions } from "../schema";

export const simulatorAssumptions: SimulatorAssumptions = {
  revenuePerVisibilityPoint: 286.67,
  explanation: [
    {
      label: "AI-driven shopper queries per month",
      value: 2000,
      unit: "count",
      explanation: "Local shoppers asking AI assistants questions like the tracked prompts.",
    },
    {
      label: "Extra share of those queries per Visibility point",
      value: 0.01,
      unit: "rate",
      explanation: "Each point means the business shows up in about 1% more of those answers.",
    },
    {
      label: "Conversion rate",
      value: 0.1,
      unit: "rate",
      explanation: "Share of shoppers who see the business in an answer and then buy.",
    },
    {
      label: "Average order value",
      value: 143.33,
      unit: "usd",
      explanation: "Typical purchase size for an outdoor gear shop.",
    },
  ],
};
