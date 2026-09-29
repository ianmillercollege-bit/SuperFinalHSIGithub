// Why the business can be missing from an AI answer, using the contract's
// ruleId list (DECISIONS.md #14). Each reason points to the opportunity
// (lib/sample/opportunities.ts) that fixes it.
import type { RuleReason } from "../schema";

export const ruleReasons: RuleReason[] = [
  {
    ruleId: "NO_FACT",
    text: "Assistants found no verified facts for your laptops, so they left you out.",
    opportunityId: "opp_structured_data",
  },
  {
    ruleId: "PRICE_MISMATCH",
    text: "Assistants quoted the wrong price for your products.",
    opportunityId: "opp_fresh_info",
  },
  {
    ruleId: "PRICE_OUTDATED",
    text: "Assistants used an old price for your products.",
    opportunityId: "opp_fresh_info",
  },
  {
    ruleId: "AVAILABILITY_MISMATCH",
    text: "Assistants had the wrong stock status for your products.",
    opportunityId: "opp_fresh_info",
  },
  {
    ruleId: "SPEC_MISMATCH",
    text: "Assistants listed wrong specs for your products.",
    opportunityId: "opp_product_details",
  },
  {
    ruleId: "INVENTED_FEATURE",
    text: "Assistants described features your products don't have.",
    opportunityId: "opp_product_details",
  },
  {
    ruleId: "UNFAIR_COMPARISON",
    text: "Assistants compared you to other brands with no verified facts behind it.",
    opportunityId: "opp_comparison_facts",
  },
  {
    ruleId: "POLICY_MISMATCH",
    text: "Assistants got your return or warranty policy wrong.",
    opportunityId: "opp_clear_policies",
  },
  {
    ruleId: "SAFETY_LEGAL",
    text: "Assistants made safety or legal claims about your products that need a person to review.",
    opportunityId: "opp_clear_policies",
  },
];
