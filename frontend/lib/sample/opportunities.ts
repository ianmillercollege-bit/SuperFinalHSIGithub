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
    title: "Add structured product and store data",
    whyItMatters:
      "Assistants skip stores whose products, hours, and location they can't read reliably.",
    effort: "Low",
    liftPoints: 4,
    steps: [
      "Add product and local-business markup to your website.",
      "List every product with its price, brand, and size range.",
      "Check the markup with a free structured-data testing tool.",
    ],
  },
  {
    id: "opp_fresh_info",
    title: "Keep prices and stock status up to date",
    whyItMatters:
      "Assistants avoid recommending a store when its prices look old or stock is unclear.",
    effort: "Med",
    liftPoints: 4,
    steps: [
      "Connect your point-of-sale stock levels to your website.",
      "Review prices on your site and listings every week.",
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
      "Publish a fact sheet on what you carry, services, and guarantees.",
      "Ask local guides and review sites to use your fact sheet.",
      "Keep your name, address, and phone identical on every listing.",
    ],
  },
  {
    id: "opp_clear_policies",
    title: "Publish clear return, rental, and safety policies",
    whyItMatters: "Shoppers ask assistants about returns; unclear policies lose those answers.",
    effort: "Low",
    liftPoints: 2,
    steps: [
      "Write your return, exchange, and rental rules on one simple page.",
      "Link that page from every product page and your footer.",
      "Only state safety certifications you can document.",
    ],
  },
];
