// Things the business can do to show up more often in AI answers. All of them
// are within the business's control (content, data, reviews, policies). Nothing
// here is paid placement: ranking is neutral.
//
// relatedReasonCodes is filled in from lib/sample/reasonCodes.ts, so each link
// is written once.
import type { Opportunity } from "../schema";

export type OpportunityInput = Omit<Opportunity, "relatedReasonCodes">;

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
    title: "Keep hours, prices, and stock status up to date",
    whyItMatters:
      "Assistants avoid recommending a store when its details look old or stock is unclear.",
    effort: "Med",
    liftPoints: 4,
    steps: [
      "Connect your point-of-sale stock levels to your website.",
      "Update holiday and seasonal hours everywhere they are listed.",
      "Review prices on your site and listings every week.",
    ],
  },
  {
    id: "opp_reviews",
    title: "Grow recent customer reviews",
    whyItMatters: "Assistants favor businesses with many recent, detailed reviews.",
    effort: "Med",
    liftPoints: 3,
    steps: [
      "Ask customers for a review on the receipt and in a follow-up email.",
      "Reply to every review, good or bad, within a few days.",
      "Encourage reviews that mention specific products and services.",
    ],
  },
  {
    id: "opp_local_listings",
    title: "Get listed on local guides and review sites",
    whyItMatters:
      "Assistants lean on trusted guides; if they don't mention you, assistants rarely do.",
    effort: "High",
    liftPoints: 2,
    steps: [
      "Claim and complete your profile on the major local listing sites.",
      "Pitch your store to local outdoor blogs and trail guides.",
      "Keep your name, address, and phone identical on every listing.",
    ],
  },
  {
    id: "opp_clear_policies",
    title: "Publish clear return and rental policies",
    whyItMatters: "Shoppers ask assistants about returns; unclear policies lose those answers.",
    effort: "Low",
    liftPoints: 2,
    steps: [
      "Write your return, exchange, and rental rules on one simple page.",
      "Link that page from every product page and your footer.",
    ],
  },
];
