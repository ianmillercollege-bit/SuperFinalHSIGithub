// Other businesses named in the same tracked AI answers. Names are generic on
// purpose. The business's own mention count is not listed here: it comes from
// the result grid in lib/sample/visibility.ts.
import type { MarketEntity } from "../schema";

export const otherBusinesses: MarketEntity[] = [
  { id: "nat_1", name: "[Competitor 1]", kind: "national", mentions: 38 },
  { id: "nat_2", name: "[Competitor 2]", kind: "national", mentions: 31 },
  { id: "nat_3", name: "[Competitor 3]", kind: "national", mentions: 24 },
  { id: "nat_4", name: "[Competitor 4]", kind: "national", mentions: 17 },
  { id: "peer_1", name: "[Similar Business 1]", kind: "peer", mentions: 22 },
  { id: "peer_2", name: "[Similar Business 2]", kind: "peer", mentions: 16 },
  { id: "peer_3", name: "[Similar Business 3]", kind: "peer", mentions: 12 },
  { id: "peer_4", name: "[Similar Business 4]", kind: "peer", mentions: 10 },
];
