// SAMPLE DATA for Harbor Home Goods (the business in lib/sample/visibilityMarket.ts).
// Claims aren't in the contract. Pages never import this file: they use lib/claims/gateway.ts.
//
// Times are written as "days/hours before seeding", so "last 30 days" stays true whenever
// the demo data is (re)seeded. Timelines are generated from each claim's status.
import type { Claim, ClaimErrorType, ClaimStatus, ClaimTimelineEntry, SpottedError } from "../claims/types";

const FILERS = [
  { name: "Dana Ruiz", role: "Owner" },
  { name: "Sam Okafor", role: "Marketing Lead" },
] as const;

/** CIRQO reviewers. */
const REVIEWERS = {
  jordan: { name: "Jordan Lee", team: "Data Quality" },
  marcus: { name: "Marcus Webb", team: "Data Quality" },
  priya: { name: "Priya Shah", team: "Legal" },
} as const;

interface ClaimDef {
  n: number;
  product: string;
  assistant: string;
  errorType: ClaimErrorType;
  aiSaid: string;
  correctFact: string;
  evidence: Claim["evidence"];
  status: ClaimStatus;
  filer: 0 | 1;
  reviewer: keyof typeof REVIEWERS;
  /** Days before seeding the claim was filed. */
  filedDaysAgo: number;
  /** Reviewed claims: hours from filing to the decision. */
  resolveAfterHours?: number;
  whatChanged?: string;
  /** Outstanding claims: the latest note (needs info / escalation). */
  note?: string;
}

const OUTCOME_ACTIONS: Partial<Record<ClaimStatus, string>> = {
  accepted: "Claim accepted, correction sent to the assistant",
  partlyAccepted: "Claim partly accepted, partial correction sent",
  notUpheld: "Claim not upheld",
};

const DEFS: ClaimDef[] = [
  // ---- Reviewed (12): 8 accepted, 1 partly accepted, 3 not upheld ----
  { n: 2, product: "Harbor 12 Cooler", assistant: "Assistant A", errorType: "price", aiSaid: "$189", correctFact: "$249 list price", evidence: [{ kind: "link", label: "Product page", url: "https://example.com/harbor-12-cooler" }], status: "accepted", filer: 0, reviewer: "jordan", filedDaysAgo: 27, resolveAfterHours: 20, whatChanged: "Assistant A now quotes $249." },
  { n: 3, product: "Trail 40 Pack", assistant: "Assistant B", errorType: "featureSpec", aiSaid: "Weighs 4.5 lb", correctFact: "Weighs 2.9 lb", evidence: [{ kind: "file", label: "Spec sheet (PDF)" }], status: "accepted", filer: 1, reviewer: "marcus", filedDaysAgo: 25, resolveAfterHours: 30, whatChanged: "Weight corrected to 2.9 lb in Assistant B answers." },
  { n: 4, product: "Summit Steel Bottle", assistant: "Assistant C", errorType: "featureSpec", aiSaid: "Keeps drinks cold for 12 hours", correctFact: "Keeps drinks cold for 24 hours", evidence: [{ kind: "link", label: "Test results page", url: "https://example.com/summit-bottle-tests" }], status: "accepted", filer: 0, reviewer: "jordan", filedDaysAgo: 23, resolveAfterHours: 16, whatChanged: "Cold-hold time corrected to 24 hours." },
  { n: 5, product: "Harbor 12 Cooler", assistant: "Assistant D", errorType: "availability", aiSaid: "Discontinued", correctFact: "In stock and shipping", evidence: [{ kind: "file", label: "Inventory screenshot" }], status: "accepted", filer: 1, reviewer: "marcus", filedDaysAgo: 21, resolveAfterHours: 12, whatChanged: "Assistant D shows the cooler as available." },
  { n: 6, product: "Trail 40 Pack", assistant: "Assistant A", errorType: "policy", aiSaid: "No returns on packs", correctFact: "60-day returns on all packs", evidence: [{ kind: "link", label: "Return policy", url: "https://example.com/returns" }], status: "accepted", filer: 0, reviewer: "jordan", filedDaysAgo: 19, resolveAfterHours: 26, whatChanged: "Return window corrected to 60 days." },
  { n: 7, product: "Camp Kitchen Set", assistant: "Assistant C", errorType: "price", aiSaid: "$39", correctFact: "$59 list price", evidence: [{ kind: "link", label: "Product page", url: "https://example.com/camp-kitchen-set" }], status: "accepted", filer: 1, reviewer: "marcus", filedDaysAgo: 17, resolveAfterHours: 9, whatChanged: "Price corrected to $59." },
  { n: 8, product: "Summit Steel Bottle", assistant: "Assistant B", errorType: "availability", aiSaid: "Only sold online", correctFact: "Sold online and in store", evidence: [{ kind: "link", label: "Store locator", url: "https://example.com/stores" }], status: "accepted", filer: 0, reviewer: "jordan", filedDaysAgo: 14, resolveAfterHours: 40, whatChanged: "In-store availability added." },
  { n: 9, product: "Ridge Rain Shell", assistant: "Assistant D", errorType: "featureSpec", aiSaid: "Not waterproof", correctFact: "Waterproof, 20,000 mm rating", evidence: [{ kind: "file", label: "Lab certificate" }], status: "accepted", filer: 1, reviewer: "marcus", filedDaysAgo: 11, resolveAfterHours: 22, whatChanged: "Waterproof rating added to answers." },
  { n: 10, product: "Harbor 12 Cooler", assistant: "Assistant B", errorType: "unfairComparison", aiSaid: "Worse insulation than every national brand", correctFact: "Independent test: similar ice retention to leading brands", evidence: [{ kind: "file", label: "Independent test report" }], status: "partlyAccepted", filer: 0, reviewer: "jordan", filedDaysAgo: 9, resolveAfterHours: 48, whatChanged: "Blanket comparison removed; assistant still cites one national brand as better." },
  { n: 11, product: "Trail 40 Pack", assistant: "Assistant C", errorType: "price", aiSaid: "$129", correctFact: "$139 list price", evidence: [{ kind: "link", label: "Product page", url: "https://example.com/trail-40-pack" }], status: "notUpheld", filer: 1, reviewer: "marcus", filedDaysAgo: 8, resolveAfterHours: 14, whatChanged: "No change: $129 was a live sale price on the date checked." },
  { n: 12, product: "Camp Kitchen Set", assistant: "Assistant A", errorType: "featureSpec", aiSaid: "Includes 4 plates", correctFact: "Includes 2 plates", evidence: [{ kind: "file", label: "Box photo" }], status: "notUpheld", filer: 0, reviewer: "jordan", filedDaysAgo: 6, resolveAfterHours: 10, whatChanged: "No change: the 4-plate bundle is sold on your own site." },
  { n: 13, product: "Ridge Rain Shell", assistant: "Assistant B", errorType: "policy", aiSaid: "Lifetime warranty", correctFact: "2-year warranty", evidence: [{ kind: "link", label: "Warranty page", url: "https://example.com/warranty" }], status: "notUpheld", filer: 1, reviewer: "priya", filedDaysAgo: 4, resolveAfterHours: 30, whatChanged: "No change: the answer came from an older warranty page still published on your site." },

  // ---- Outstanding (3) ----
  { n: 14, product: "Harbor 12 Cooler", assistant: "Assistant B", errorType: "featureSpec", aiSaid: "Keeps ice for 7 days", correctFact: "Keeps ice for up to 4 days", evidence: [{ kind: "file", label: "Ice-retention test (PDF)" }], status: "inReview", filer: 0, reviewer: "jordan", filedDaysAgo: 3 },
  { n: 15, product: "Trail 40 Pack", assistant: "Assistant C", errorType: "availability", aiSaid: "Out of stock everywhere", correctFact: "In stock online and in store", evidence: [{ kind: "link", label: "Product page", url: "https://example.com/trail-40-pack" }], status: "needsInfo", filer: 1, reviewer: "marcus", filedDaysAgo: 5, note: "Please add a current inventory screenshot." },
  { n: 16, product: "Summit Steel Bottle", assistant: "Assistant D", errorType: "safetyLegal", aiSaid: "FDA certified safe for toddlers", correctFact: "BPA-free; no FDA certification is claimed", evidence: [{ kind: "file", label: "Materials statement" }], status: "escalated", filer: 0, reviewer: "priya", filedDaysAgo: 2, note: "Safety claim sent to Legal for review." },
];

const SPOTTED: SpottedError[] = [
  { id: "spt_001", product: "Harbor 12 Cooler", assistant: "Assistant C", errorType: "price", aiSaid: "$199", verifiedFact: "$249 list price" },
  { id: "spt_002", product: "Trail 40 Pack", assistant: "Assistant D", errorType: "policy", aiSaid: "30-day returns", verifiedFact: "60-day returns" },
];

const HOUR = 3600_000;

/** Fresh copy of the sample claims, timed relative to `now`. */
export function buildClaimsSeed(now: Date): Claim[] {
  const iso = (ms: number) => new Date(Math.floor(ms / 60_000) * 60_000).toISOString().replace(".000Z", "Z");
  return DEFS.map((d) => {
    const filedMs = now.getTime() - d.filedDaysAgo * 24 * HOUR;
    const filer = FILERS[d.filer];
    const reviewer = REVIEWERS[d.reviewer];
    const timeline: ClaimTimelineEntry[] = [
      { at: iso(filedMs), actor: filer.name, action: "Claim filed" },
      { at: iso(filedMs + 2 * HOUR), actor: reviewer.name, action: "Review started" },
    ];
    let resolution: Claim["resolution"];
    if (d.status === "needsInfo") {
      timeline.push({ at: iso(filedMs + 20 * HOUR), actor: reviewer.name, action: "More evidence requested", note: d.note });
    } else if (d.status === "escalated") {
      timeline.push({ at: iso(filedMs + 6 * HOUR), actor: reviewer.name, action: "Escalated to Legal", note: d.note });
    } else if (d.resolveAfterHours !== undefined) {
      const resolvedAt = iso(filedMs + d.resolveAfterHours * HOUR);
      timeline.push({ at: resolvedAt, actor: reviewer.name, action: OUTCOME_ACTIONS[d.status]!, note: d.whatChanged });
      resolution = { whatChanged: d.whatChanged!, resolvedAt };
    }
    return {
      id: `clm_${String(d.n).padStart(3, "0")}`,
      product: d.product,
      assistant: d.assistant,
      errorType: d.errorType,
      aiSaid: d.aiSaid,
      correctFact: d.correctFact,
      evidence: d.evidence,
      status: d.status,
      filedBy: { ...filer },
      filedAt: iso(filedMs),
      updatedAt: timeline[timeline.length - 1].at,
      reviewer: { ...reviewer },
      ...(resolution ? { resolution } : {}),
      timeline,
    };
  });
}

export function buildSpottedErrorsSeed(): SpottedError[] {
  return SPOTTED.map((s) => ({ ...s }));
}
