// The one place the demo business is named: Kestrel, the same fictional brand as the
// contract data (DECISIONS.md #28; contract section 9: brand_001, the CIRQO client).
// Every page and every piece of sample data reads the business from here.
//
// The contract has no brand or business endpoint. Live pages already show the `brandName`
// that GET /visibility/summary returns; this constant is only for the sample-only pages
// (Growth Simulator, AI Coach) and the sample user chip.
import type { Business } from "./schema";

export const BUSINESS: Business = {
  id: "brand_001",
  name: "Kestrel",
  shortName: "Kestrel",
  category: "Laptop brand",
  region: "United States",
};
