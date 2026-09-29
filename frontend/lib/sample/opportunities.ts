// Things the business can do to show up more often in AI answers. All of them
// are within the business's control (content, data, policies). Nothing here is
// paid placement: ranking is neutral.
//
// relatedRuleIds is filled in from lib/sample/ruleReasons.ts, so each link is
// written once.
import type { Opportunity } from "../schema";

export type OpportunityInput = Omit<Opportunity, "relatedRuleIds">;

export const opportunityInputs: OpportunityInput[] = [
  {
    id: "opp_structured_data",
    title: "Add structured product data",
    whyItMatters:
      "Assistants skip brands whose products, prices, and specs they can't read reliably.",
    effort: "Low",
    liftPoints: 4,
    steps: [
      "Add product markup (price, specs, availability) to every product page.",
      "List every model with its price, RAM, storage, screen, and weight.",
      "Check the markup with a free structured-data testing tool.",
    ],
  },
  {
    id: "opp_fresh_info",
    title: "Keep prices and stock status up to date",
    whyItMatters:
      "Assistants avoid recommending a laptop when its price looks old or stock is unclear.",
    effort: "Med",
    liftPoints: 4,
    steps: [
      "Send live stock levels to your website and retail partners.",
      "Review prices on your site and retailer listings every week.",
      "Remove discontinued products from every listing.",
    ],
  },
  {
    id: "opp_product_details",
    title: "Publish complete, accurate product specs",
    whyItMatters: "When specs are missing, assistants guess, and wrong specs cost trust and sales.",
    effort: "Med",
    liftPoints: 3,
    steps: [
      "Add full specs (weight, materials, sizes) to every product page.",
      "Use the same specs on your site, listings, and marketplaces.",
      "Correct any product feature a customer or assistant got wrong.",
    ],
  },
  {
    id: "opp_comparison_facts",
    title: "Publish verified comparison facts",
    whyItMatters:
      "Assistants compare stores anyway; give them facts so the comparison is fair.",
    effort: "High",
    liftPoints: 2,
    steps: [
      "Publish a fact sheet with verified specs, benchmarks, and warranty terms.",
      "Ask review sites and retailers to use your fact sheet.",
      "Keep model names identical on your site and every retailer listing.",
    ],
  },
  {
    id: "opp_clear_policies",
    title: "Publish clear return, warranty, and safety policies",
    whyItMatters: "Shoppers ask assistants about returns; unclear policies lose those answers.",
    effort: "Low",
    liftPoints: 2,
    steps: [
      "Write your return, exchange, and warranty rules on one simple page.",
      "Link that page from every product page and your footer.",
      "Only state safety certifications you can document.",
    ],
  },
];
