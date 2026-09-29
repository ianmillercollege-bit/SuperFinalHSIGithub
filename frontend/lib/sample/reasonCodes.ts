// The fixed list of reasons a business can be missing from an AI answer.
// Each reason points to the opportunity (lib/sample/opportunities.ts) that fixes it.
import type { ReasonCodeInfo } from "../schema";

export const reasonCodes: ReasonCodeInfo[] = [
  {
    code: "MISSING_STRUCTURED_DATA",
    text: "Your products and store details aren't in a format AI assistants can read easily.",
    opportunityId: "opp_structured_data",
  },
  {
    code: "OUTDATED_INFO",
    text: "Assistants found old hours, prices, or product details for your store.",
    opportunityId: "opp_fresh_info",
  },
  {
    code: "FEW_REVIEWS",
    text: "You have fewer recent customer reviews than the businesses that were named.",
    opportunityId: "opp_reviews",
  },
  {
    code: "COMPETITOR_CITED_MORE",
    text: "The review sites and guides assistants rely on mention other stores more often.",
    opportunityId: "opp_local_listings",
  },
  {
    code: "UNCLEAR_POLICY",
    text: "Your return or rental policy is hard to find or unclear.",
    opportunityId: "opp_clear_policies",
  },
  {
    code: "STOCK_STATUS_UNKNOWN",
    text: "Assistants couldn't tell whether you have the item in stock.",
    opportunityId: "opp_fresh_info",
  },
];
