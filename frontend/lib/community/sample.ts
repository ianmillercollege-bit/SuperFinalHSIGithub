// SAMPLE ONLY. The Community program (contract v1.6, section 7e) is not on the live backend yet. Until it is, the
// calls in lib/api.ts fall back to this data, and the screens say so. Every shape below is the contract's; the
// organizations are the three the contract names, and every company and product is fictional.
// Delete this file once GET /community/catalog is live.
import type {
  CommunityCatalogFilters,
  CommunityCatalogResponse,
  CommunityImpact,
  CommunityItem,
  CommunityRequest,
  CommunityRequestBody,
} from "../types";

/** Ids of sample rows all start with this, so a real request is never mistaken for one. */
export const SAMPLE_PREFIX = "sample_";

export const SAMPLE_PARTNERS = [
  { orgId: "org_sample_1", orgName: "Bexar Valley School District" },
  { orgId: "org_sample_2", orgName: "Lone Star Veterans Network" },
  { orgId: "org_sample_3", orgName: "Bridgeway Community Tech" },
] as const;

const item = (
  n: number,
  name: string,
  brandId: string,
  brandName: string,
  category: CommunityItem["category"],
  condition: CommunityItem["condition"],
  price: number,
  unitsPledged: number,
  unitsPlaced: number,
  conditionNotes: string,
  warrantyMonths: number,
  fact: string,
): CommunityItem => ({
  productId: `${SAMPLE_PREFIX}prod_${n}`,
  name,
  brandId,
  brandName,
  category,
  condition,
  price,
  verified: true,
  communityPledge: { unitsPledged, unitsPlaced, conditionNotes, warrantyMonths },
  facts: [{ text: fact, claimStatus: "correct", factId: `${SAMPLE_PREFIX}fact_${n}` }],
});

const ITEMS: CommunityItem[] = [
  item(1, "Kestrel Aero 14 (refurbished)", "brand_001", "Kestrel", "laptops", "refurbished", 289, 40, 12, "Grade A, new battery", 12, "8 GB memory, 256 GB storage, 14 inch screen."),
  item(2, "Kestrel Trail 15 (surplus)", "brand_001", "Kestrel", "laptops", "surplus", 349, 25, 5, "Sealed box, last year's model", 12, "16 GB memory, 512 GB storage, 15 inch screen."),
  item(3, "Arcton Slate 10 (refurbished)", "brand_002", "Arcton", "phones_tablets", "refurbished", 139, 60, 20, "Grade B, light wear on the case", 6, "64 GB storage, 10 inch screen."),
  item(4, "Novex Pulse 6 (surplus)", "brand_003", "Novex", "phones_tablets", "surplus", 179, 30, 0, "New in box, previous season", 12, "128 GB storage, 6 inch screen."),
];

let requests: CommunityRequest[] = [
  { requestId: `creq_${SAMPLE_PREFIX}1`, status: "pending_approval", productId: `${SAMPLE_PREFIX}prod_1`, brandId: "brand_001", partner: { ...SAMPLE_PARTNERS[0] }, units: 10, purpose: "Laptops for 10 students in the fall cohort", createdAt: "2026-09-29T15:20:00Z" },
  { requestId: `creq_${SAMPLE_PREFIX}2`, status: "approved", productId: `${SAMPLE_PREFIX}prod_1`, brandId: "brand_001", partner: { ...SAMPLE_PARTNERS[1] }, units: 12, purpose: "Laptops for a job-training lab", createdAt: "2026-09-27T18:05:00Z" },
];

const available = (i: CommunityItem) => i.communityPledge.unitsPledged - i.communityPledge.unitsPlaced;

export function sampleCatalog(filters: CommunityCatalogFilters): CommunityCatalogResponse {
  const items = ITEMS.filter((i) => (!filters.category || i.category === filters.category) && (!filters.brandId || i.brandId === filters.brandId) && (!filters.condition || i.condition === filters.condition))
    .sort((a, b) => available(b) - available(a) || a.name.localeCompare(b.name))
    .slice(0, filters.limit ?? 100)
    .map((i) => ({ ...i, communityPledge: { ...i.communityPledge } }));
  return { items };
}

export function sampleCreateRequest(body: CommunityRequestBody, partner: { orgId: string; orgName: string }): CommunityRequest {
  const product = ITEMS.find((i) => i.productId === body.productId);
  if (!product) throw new SampleError("NOT_FOUND", "That product is not pledged.");
  if (!Number.isInteger(body.units) || body.units < 1 || body.units > available(product)) {
    throw new SampleError("VALIDATION_ERROR", `Ask for between 1 and ${available(product)} units.`);
  }
  const made: CommunityRequest = {
    requestId: `creq_${SAMPLE_PREFIX}${requests.length + 1}`,
    status: "pending_approval",
    productId: product.productId,
    brandId: product.brandId,
    partner,
    units: body.units,
    purpose: body.purpose,
    createdAt: new Date().toISOString(),
  };
  requests = [made, ...requests];
  return made;
}

export function sampleImpact(brandId: string): CommunityImpact {
  const mine = ITEMS.filter((i) => i.brandId === brandId);
  const mineRequests = requests.filter((r) => r.brandId === brandId);
  return {
    unitsPledged: mine.reduce((sum, i) => sum + i.communityPledge.unitsPledged, 0),
    unitsPlaced: mine.reduce((sum, i) => sum + i.communityPledge.unitsPlaced, 0),
    partnersServed: new Set(mineRequests.filter((r) => r.status === "approved").map((r) => r.partner.orgId)).size,
    requestsPending: mineRequests.filter((r) => r.status === "pending_approval").length,
    byCategory: [],
  };
}

/** Carries a contract error code, so screens describe it like any backend error. */
export class SampleError extends Error {
  constructor(
    public code: "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}
