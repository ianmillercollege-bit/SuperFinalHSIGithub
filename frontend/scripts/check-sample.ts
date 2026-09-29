// npm run check:sample
// Verifies the sample data is complete and consistent, the simulator hits its
// anchors, and the coach answers every suggested question. (Type checking
// against lib/schema.ts runs first, via tsc, in the npm script.)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { simulatorAssumptions } from "../lib/config/simulatorAssumptions";
import { COACH_DEMO_DISCLAIMER, SUGGESTED_QUESTIONS, loadCoachContext } from "../lib/coach";
import { matchIntent, sampleCoach } from "../lib/coach/sampleCoach";
import { getOverview } from "../lib/dataSource";
import {
  buildMarketReport,
  buildOpportunitiesReport,
  buildOverview,
  buildSimulatorBaseline,
  buildVisibilityReport,
  visibilityScoreFromRate,
} from "../lib/sample/derive";
import { sampleBusiness } from "../lib/sample/sampleBusiness";
import { allLeversOn, simulate } from "../lib/simulator";
import { createClaimsGateway, nextClaimId, storageKey } from "../lib/claims/gateway";
import { can } from "../lib/claims/permissions";
import type { Claim, ClaimStatus } from "../lib/claims/types";
import { validateClaim, validateEvidenceItem, type ClaimInput } from "../lib/claims/validation";
import { canTransition, type Actor } from "../lib/claims/workflow";
import { demoAccount } from "../lib/sample/demoAccounts";
import {
  activityFrom,
  averageWaitHours,
  correctionShare,
  medianTimeToResolveHours,
  outstandingCount,
  reviewedCount,
  waitingForEvidenceCount,
} from "../lib/claims/selectors";
import { buildClaimsSeed, buildSpottedErrorsSeed } from "../lib/sample/claims";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  (${detail})` : ""}`);
}
function section(title: string) {
  console.log(`\n${title}`);
}

async function main() {
  const visibility = buildVisibilityReport();
  const overview = buildOverview();
  const market = buildMarketReport();
  const { opportunities, totalLiftPoints } = buildOpportunitiesReport();
  const baseline = buildSimulatorBaseline();
  const oppIds = new Set(opportunities.map((o) => o.id));

  section("Sample data shape");
  check("12 tracked prompts", visibility.prompts.length === 12, `${visibility.prompts.length}`);
  check("4 assistants", visibility.assistants.length === 4, `${visibility.assistants.length}`);
  const pairs = new Set(visibility.results.map((r) => `${r.promptId}|${r.assistantId}`));
  check("every prompt x assistant has exactly one result", pairs.size === 48 && visibility.results.length === 48, `${visibility.results.length}`);
  check(
    "appeared results have a rank and no reasons; absent results have reasons and no rank",
    visibility.results.every((r) => (r.appeared ? r.rank !== null && r.rank >= 1 && r.ruleIds.length === 0 : r.rank === null && r.ruleIds.length > 0)),
  );
  check("8 weeks of history", overview.history.length === 8, `${overview.history.length}`);
  check("3 strengths, 3 weaknesses", overview.strengths.length === 3 && overview.weaknesses.length === 3);
  check("5 opportunities", opportunities.length === 5, `${opportunities.length}`);
  check("opportunity liftPoints sum to 15", totalLiftPoints === 15, `${totalLiftPoints}`);
  check(
    "every contract ruleId (all 9) links to an existing opportunity",
    visibility.ruleReasons.length === 9 && visibility.ruleReasons.every((r) => oppIds.has(r.opportunityId)),
  );
  check("every opportunity is linked to at least one ruleId", opportunities.every((o) => o.relatedRuleIds.length > 0));
  check("4 similar businesses and 4 national competitors",
    market.entities.filter((e) => e.kind === "peer").length === 4 && market.entities.filter((e) => e.kind === "national").length === 4);

  section("Consistency across views");
  check("AI Visibility Score is 63", overview.visibilityScore === 63, `${overview.visibilityScore}`);
  check("score is up from last week", overview.weeklyChange > 0, `${overview.previousScore} -> ${overview.visibilityScore}`);
  check("score = round(visibilityRate x 100) from the result grid (decision 13)",
    overview.visibilityScore === visibilityScoreFromRate(visibility.appearanceRate),
    `${visibility.appearances}/${visibility.checks}`);
  check("last history week = this week's score", overview.history.at(-1)?.score === overview.visibilityScore);
  check("overview counts match the visibility report",
    overview.appearances === visibility.appearances && overview.checks === visibility.checks);
  check("per-assistant appearances add up to the total",
    visibility.byAssistant.reduce((s, a) => s + a.appearances, 0) === visibility.appearances);
  check("this business's market mentions = its appearances",
    market.entities.find((e) => e.kind === "this_business")?.mentions === visibility.appearances);
  const shareSum = market.shares.national + market.shares.peers + market.shares.thisBusiness;
  check("market shares sum to 100%", Math.abs(shareSum - 1) < 1e-9, shareSum.toFixed(4));
  check("weaknesses are the 3 most common absence reasons",
    overview.weaknesses.every((w, i) => w.ruleId === visibility.reasons[i].ruleId && w.count === visibility.reasons[i].count));
  check("simulator baseline = overview score", baseline.visibilityScore === overview.visibilityScore);

  section("Simulator");
  const all = simulate(allLeversOn(baseline.levers), baseline, simulatorAssumptions);
  check("all levers at 100%: 63 -> 78", all.visibilityBefore === 63 && all.visibilityAfter === 78, `${all.visibilityBefore} -> ${all.visibilityAfter}`);
  check("all levers at 100%: +$4,300/month", all.revenueDeltaPerMonth === 4300, `$${all.revenueDeltaPerMonth}`);
  const none = simulate({}, baseline, simulatorAssumptions);
  check("no levers: no change", none.visibilityAfter === 63 && none.revenueDeltaPerMonth === 0);
  const half = simulate(Object.fromEntries(baseline.levers.map((l) => [l.opportunityId, 0.5])), baseline, simulatorAssumptions);
  check("all levers at 50%: 63 -> 70.5", half.visibilityAfter === 70.5, `${half.visibilityAfter}, $${half.revenueDeltaPerMonth}`);
  const explained = simulatorAssumptions.explanation.reduce((p, a) => p * a.value, 1);
  check("assumptions list explains revenuePerVisibilityPoint (within $1)",
    Math.abs(explained - simulatorAssumptions.revenuePerVisibilityPoint) < 1,
    `$${explained.toFixed(2)} vs $${simulatorAssumptions.revenuePerVisibilityPoint}`);
  check("overview potential matches simulator",
    overview.potentialScore === all.visibilityAfter && overview.potentialRevenuePerMonth === all.revenueDeltaPerMonth);

  section("Data source");
  const loaded = await getOverview();
  check("extras return frontend sample data", loaded.source === "sample");

  section("Coach");
  const context = await loadCoachContext();
  for (const { question, intent } of SUGGESTED_QUESTIONS) {
    const reply = await sampleCoach.ask(question, [], context);
    check(`"${question}"`,
      matchIntent(question) === intent && reply.text.length > 0 && reply.sources.length > 0,
      `intent ${matchIntent(question)}, ${reply.sources.length} sources`);
    const dollarsLabeled = [reply.text, ...reply.sources.map((c) => `${c.label} ${c.value}`)]
      .filter((t) => t.includes("$"))
      .every((t) => /illustrative estimate/i.test(t));
    check(`  revenue in that answer is labeled "illustrative estimate" (decision 12)`, dollarsLabeled);
  }
  const fallback = await sampleCoach.ask("What's the weather tomorrow?", [], context);
  check("unknown question gets a friendly fallback", matchIntent("What's the weather tomorrow?") === "fallback" && fallback.sources.length > 0);
  check("every coach answer says it is a pre-written demo answer (decision 11)",
    fallback.disclaimer === COACH_DEMO_DISCLAIMER && /pre-written/i.test(COACH_DEMO_DISCLAIMER));

  await checkClaims();
  await checkClaimsWorkflow();

  section("Business name");
  const offenders = sourceFiles(path.join(__dirname, ".."))
    .filter((f) => !f.endsWith(path.join("sample", "sampleBusiness.ts")))
    .filter((f) => readFileSync(f, "utf8").includes(sampleBusiness.name));
  check("name is written only in lib/sample/sampleBusiness.ts", offenders.length === 0, offenders.join(", "));

  console.log(failures === 0 ? "\nAll sample checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

async function checkClaims() {
  section("Claims (sample-only)");
  const now = new Date("2026-09-29T18:00:00Z");
  const claims = buildClaimsSeed(now);
  const spotted = buildSpottedErrorsSeed();
  const byStatus = (st: string) => claims.filter((c) => c.status === st).map((c) => c.id);

  check("3 outstanding: clm_014 inReview, clm_015 needsInfo, clm_016 escalated safetyLegal",
    outstandingCount(claims) === 3 &&
      byStatus("inReview").join() === "clm_014" &&
      byStatus("needsInfo").join() === "clm_015" &&
      byStatus("escalated").join() === "clm_016" &&
      claims.find((c) => c.id === "clm_016")?.errorType === "safetyLegal",
    `${outstandingCount(claims)} outstanding`);
  check("12 reviewed in the last 30 days: 8 accepted, 1 partly accepted, 3 not upheld",
    reviewedCount(claims, now) === 12 && byStatus("accepted").length === 8 &&
      byStatus("partlyAccepted").length === 1 && byStatus("notUpheld").length === 3,
    `${reviewedCount(claims, now)} = ${byStatus("accepted").length}/${byStatus("partlyAccepted").length}/${byStatus("notUpheld").length}`);
  check("2 spotted errors", spotted.length === 2);

  const ids = [...claims.map((c) => c.id), ...spotted.map((e) => e.id)];
  check("ids are unique and prefixed (clm_###, spt_###)",
    new Set(ids).size === ids.length &&
      claims.every((c) => /^clm_\d{3}$/.test(c.id)) && spotted.every((e) => /^spt_\d{3}$/.test(e.id)));
  const isoZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  const allTimes = claims.flatMap((c) => [c.filedAt, c.updatedAt, ...(c.resolution ? [c.resolution.resolvedAt] : []), ...c.timeline.map((t) => t.at)]);
  check("all timestamps are ISO 8601 UTC", allTimes.every((t) => isoZ.test(t)));
  check("timelines are in order: filed first, updatedAt = last step, nothing in the future",
    claims.every((c) =>
      c.timeline[0]?.at === c.filedAt && c.timeline[0]?.action === "Claim filed" &&
      c.timeline.every((t, i) => i === 0 || Date.parse(t.at) >= Date.parse(c.timeline[i - 1].at)) &&
      c.updatedAt === c.timeline[c.timeline.length - 1].at &&
      Date.parse(c.updatedAt) <= now.getTime()));
  check("reviewed claims have a reviewer and a resolution after filing; outstanding ones have no resolution",
    claims.every((c) => ["accepted", "partlyAccepted", "notUpheld"].includes(c.status)
      ? !!c.reviewer && !!c.resolution && Date.parse(c.resolution.resolvedAt) > Date.parse(c.filedAt)
      : !c.resolution));
  const reviewerNames = new Set(claims.map((c) => `${c.reviewer?.name} (${c.reviewer?.team})`));
  check("reviewers are Jordan Lee, Marcus Webb (Data Quality) and Priya Shah (Legal)",
    [...reviewerNames].sort().join() === "Jordan Lee (Data Quality),Marcus Webb (Data Quality),Priya Shah (Legal)");

  const share = correctionShare(claims, now);
  check("share that led to a correction = (accepted + partly accepted) / reviewed", share === 9 / 12, `${share}`);
  const median = medianTimeToResolveHours(claims, now);
  const hours = claims.filter((c) => c.resolution).map((c) => (Date.parse(c.resolution!.resolvedAt) - Date.parse(c.filedAt)) / 3600_000).sort((a, b) => a - b);
  check("median time to resolve matches the timestamps", median === (hours[5] + hours[6]) / 2, `${median} h`);
  check("waiting-for-your-evidence count = needsInfo claims", waitingForEvidenceCount(claims) === 1);
  const wait = averageWaitHours(claims, now);
  const expectedWait = claims.filter((c) => ["submitted", "inReview", "needsInfo", "escalated"].includes(c.status))
    .reduce((sum, c) => sum + (now.getTime() - Date.parse(c.filedAt)) / 3600_000, 0) / 3;
  check("average wait = mean hours open across outstanding claims", wait === expectedWait, `${wait?.toFixed(1)} h`);
  const activity = activityFrom(claims);
  check("activity is every timeline step, newest first",
    activity.length === claims.reduce((n, c) => n + c.timeline.length, 0) &&
      activity.every((a, i) => i === 0 || Date.parse(a.at) <= Date.parse(activity[i - 1].at)));

  // Gateway with a fake browser storage.
  const store = new Map<string, string>();
  const fakeStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  (globalThis as { window?: unknown }).window = { localStorage: fakeStorage };
  try {
    store.set(storageKey("check"), "{not json");
    const gw = createClaimsGateway("check");
    const listed = await gw.listClaims();
    check("corrupt stored data reseeds", listed.length === 15 && JSON.parse(store.get(storageKey("check"))!).version === 1);
    check("listClaims filters match the selectors",
      (await gw.listClaims({ group: "outstanding" })).length === outstandingCount(listed) &&
        (await gw.listClaims({ group: "reviewed" })).length === 12 &&
        (await gw.listClaims({ status: "needsInfo" })).length === waitingForEvidenceCount(listed));
    check("getClaim finds a claim and returns null for an unknown id",
      (await gw.getClaim("clm_015"))?.status === "needsInfo" && (await gw.getClaim("clm_999")) === null);
    check("listSpottedErrors and listActivity return the seed", (await gw.listSpottedErrors()).length === 2 &&
      (await gw.listActivity()).length === activityFrom(listed).length);
    let notified = 0;
    const stop = gw.subscribe(() => notified++);
    store.set(storageKey("check"), JSON.stringify({ ...JSON.parse(store.get(storageKey("check"))!), claims: [] }));
    await gw.resetDemoData();
    stop();
    check("Reset demo data reseeds claims and notifies subscribers",
      notified === 1 && JSON.parse(store.get(storageKey("check"))!).claims.length === 15 && (await gw.listClaims()).length === 15);
    check("storage key is versioned and per profile", storageKey("check") === "cirqo.sample.v1.check.claims");
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
}

async function checkClaimsWorkflow() {
  section("Claims workflow, validation and permissions");
  const now = new Date("2026-09-29T18:00:00Z");
  const seedClaims = buildClaimsSeed(now);
  const base = seedClaims.find((c) => c.id === "clm_014")!;
  const reviewer: Actor = { name: "Jordan Lee", role: "CIRQO Data Quality", kind: "reviewer" };
  const business: Actor = { name: "Dana Ruiz", role: "Owner", kind: "business" };
  const statuses: ClaimStatus[] = ["submitted", "inReview", "needsInfo", "escalated", "accepted", "partlyAccepted", "notUpheld", "withdrawn"];
  // The allowed moves, written out independently of lib/claims/workflow.ts.
  const expected: Record<ClaimStatus, ClaimStatus[]> = {
    submitted: ["inReview", "withdrawn"],
    inReview: ["needsInfo", "accepted", "partlyAccepted", "notUpheld", "escalated", "withdrawn"],
    needsInfo: ["inReview", "withdrawn"],
    escalated: [], accepted: [], partlyAccepted: [], notUpheld: [], withdrawn: [],
  };
  const withEvidence = (status: ClaimStatus): Claim => ({
    ...base,
    status,
    timeline: [
      ...base.timeline,
      { at: base.updatedAt, actor: "Jordan Lee", action: "More evidence requested" },
      { at: base.updatedAt, actor: "Dana Ruiz", action: "Evidence added" },
    ],
  });
  let allowed = 0;
  const wrong: string[] = [];
  for (const from of statuses) {
    for (const to of statuses) {
      const actor = to === "withdrawn" || (from === "needsInfo" && to === "inReview") ? business : reviewer;
      const got = canTransition(withEvidence(from), to, actor).ok;
      if (got) allowed++;
      if (got !== expected[from].includes(to)) wrong.push(`${from}->${to}`);
    }
  }
  check("all 64 status moves: exactly the 10 allowed ones pass, 54 are refused", wrong.length === 0 && allowed === 10, wrong.join(", ") || `${allowed} allowed`);
  check("terminal statuses (accepted, partly accepted, not upheld, withdrawn) have no moves",
    ["accepted", "partlyAccepted", "notUpheld", "withdrawn"].every((st) => statuses.every((to) => !canTransition(withEvidence(st as ClaimStatus), to, reviewer).ok && !canTransition(withEvidence(st as ClaimStatus), to, business).ok)));
  check("needsInfo -> inReview is refused until evidence is added",
    !canTransition({ ...base, status: "needsInfo", timeline: [...base.timeline, { at: base.updatedAt, actor: "Jordan Lee", action: "More evidence requested" }] }, "inReview", business).ok);
  check("only the business can withdraw; only reviewers make review decisions",
    !canTransition(withEvidence("inReview"), "withdrawn", reviewer).ok && !canTransition(withEvidence("inReview"), "accepted", business).ok);

  const good: ClaimInput = {
    product: "Ridge Rain Shell", assistant: "Assistant A", errorType: "price",
    aiSaid: "Costs $79 at Harbor", correctFact: "Costs $129 list price",
    evidence: [{ kind: "link", label: "Product page", url: "https://example.com/rain-shell" }],
  };
  const errs = (input: Partial<ClaimInput>) => validateClaim({ ...good, ...input }, seedClaims);
  check("valid claim has no errors", Object.keys(errs({})).length === 0);
  check("product, assistant and type are required",
    !!errs({ product: " " }).product && !!errs({ assistant: "" }).assistant && !!errs({ errorType: "" }).errorType);
  check("aiSaid and correctFact must be 10 to 1000 characters after trimming",
    !!errs({ aiSaid: "   short    " }).aiSaid && !errs({ aiSaid: "  ten chars!  " }).aiSaid &&
      !!errs({ correctFact: "x".repeat(1001) }).correctFact && !errs({ correctFact: "x".repeat(1000) }).correctFact);
  const link = (url: string) => ({ kind: "link" as const, label: "Link", url });
  check("evidence: 1 to 5 items; links must be http(s); file names up to 100 characters",
    !!errs({ evidence: [] }).evidence && !!errs({ evidence: Array(6).fill(link("https://a.com")) }).evidence &&
      !errs({ evidence: Array(5).fill(link("https://a.com")) }).evidence &&
      validateEvidenceItem(link("ftp://a.com")) !== null && validateEvidenceItem(link("not a url")) !== null &&
      validateEvidenceItem(link("http://a.com/x")) === null &&
      validateEvidenceItem({ kind: "file", label: "f".repeat(101) }) !== null && validateEvidenceItem({ kind: "file", label: "f".repeat(100) }) === null);
  check("duplicate open claim (same product, type, assistant) is blocked; closed ones are not",
    !!errs({ product: " harbor 12 cooler ", assistant: "Assistant B", errorType: "featureSpec" }).duplicate &&
      !errs({ product: "Harbor 12 Cooler", assistant: "Assistant C", errorType: "featureSpec" }).duplicate &&
      !errs({ product: "Harbor 12 Cooler", assistant: "Assistant A", errorType: "price" }).duplicate);

  check("Owner and Approver can file, add evidence and withdraw; Viewer can't",
    (["Owner", "Approver"] as const).every((r) => can(r, "fileClaim") && can(r, "addEvidence") && can(r, "withdrawClaim")) &&
      !can("Viewer", "fileClaim") && !can("Viewer", "addEvidence") && !can("Viewer", "withdrawClaim"));
  check("next id continues from the highest clm_###",
    nextClaimId(seedClaims) === "clm_017" && nextClaimId([]) === "clm_001" &&
      nextClaimId([{ ...base, id: "clm_002" }, { ...base, id: "clm_099" }]) === "clm_100");

  // Full flows through the gateway, with a fake browser storage and a controllable clock.
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } };
  let t = now.getTime();
  const later = (hours: number) => (t += hours * 3600_000);
  const gw = createClaimsGateway("workflow", { now: () => new Date(t) });
  const owner = demoAccount("Owner");
  const approver = demoAccount("Approver");
  const viewer = demoAccount("Viewer");
  try {
    const before = (await gw.listClaims()).length;
    const denied = await Promise.all([gw.createClaim(good, viewer), gw.addEvidence("clm_015", [link("https://a.com")], viewer), gw.withdrawClaim("clm_014", viewer)]);
    check("Viewer is refused for file, add evidence and withdraw, and nothing changes",
      denied.every((r) => !r.ok && r.error.kind === "forbidden") && (await gw.listClaims()).length === before);

    later(1);
    const first = await gw.createClaim(good, owner);
    later(1);
    const second = await gw.createClaim({ ...good, product: "Camp Kitchen Set" }, approver);
    check("new claims get clm_017, then clm_018, filed by the account with its role",
      first.ok && first.claim.id === "clm_017" && first.claim.status === "submitted" && first.claim.filedBy.role === "Owner" &&
        second.ok && second.claim.id === "clm_018");
    const dup = await gw.createClaim(good, approver);
    check("filing the same open claim again is blocked as a duplicate", !dup.ok && dup.error.kind === "duplicate");
    const invalid = await gw.createClaim({ ...good, aiSaid: "short" }, owner);
    check("invalid input returns field errors, not an API error code",
      !invalid.ok && invalid.error.kind === "validation" && !!invalid.error.fieldErrors?.aiSaid);

    later(1);
    const safety = await gw.createClaim({ ...good, product: "Summit Steel Bottle", errorType: "safetyLegal", aiSaid: "Certified safe for toddlers", correctFact: "No safety certification is claimed" }, owner);
    check("safetyLegal claims go straight to escalated with Priya Shah (Legal)",
      safety.ok && safety.claim.status === "escalated" && safety.claim.reviewer?.name === "Priya Shah" &&
        safety.claim.timeline.map((e) => e.action).join(" > ") === "Claim filed > Escalated to Legal");
    const safetyAccept = await gw.reviewClaim(safety.ok ? safety.claim.id : "", "accept", "", "Fixed");
    check("escalated safety claims are never resolved by the demo reviewer",
      !safetyAccept.ok && safetyAccept.error.kind === "invalidTransition" && (await gw.getClaim("clm_016"))?.status === "escalated");

    const activityBefore = (await gw.listActivity()).length;
    later(2);
    const evidence = await gw.addEvidence("clm_015", [{ kind: "file", label: "inventory-2026-09-29.png" }], approver);
    const steps = evidence.ok ? evidence.claim.timeline.slice(-2) : [];
    check("adding evidence to a needsInfo claim sends it back to review, with name, role and time recorded",
      evidence.ok && evidence.claim.status === "inReview" && evidence.claim.evidence.length === 2 &&
        steps.map((e) => e.action).join(" > ") === "Evidence added > Review started" &&
        steps.every((e) => e.actor === "Sam Okafor" && e.actorRole === "Approver" && e.at === new Date(t).toISOString().replace(".000Z", "Z")) &&
        (await gw.listActivity()).length === activityBefore + 2);
    const tooMany = await gw.addEvidence("clm_015", Array(4).fill(link("https://example.com/x")), owner);
    check("more than 5 evidence items in total is refused", !tooMany.ok && tooMany.error.kind === "evidenceLimit");

    later(1);
    const withdrawn = await gw.withdrawClaim("clm_014", owner, "Fixed on our side.");
    const again = await gw.withdrawClaim("clm_014", owner);
    check("withdraw works once; a withdrawn claim can't be withdrawn again",
      withdrawn.ok && withdrawn.claim.status === "withdrawn" && !again.ok && again.error.kind === "invalidTransition");
    check("after withdrawing, the same claim can be filed again (no longer open)",
      Object.keys(validateClaim({ product: "Harbor 12 Cooler", assistant: "Assistant B", errorType: "featureSpec", aiSaid: "Keeps ice for 7 days", correctFact: "Keeps ice for up to 4 days", evidence: [link("https://a.com")] }, await gw.listClaims())).length === 0);

    later(1);
    const started = await gw.reviewClaim("clm_017", "startReview", "");
    const noNote = await gw.reviewClaim("clm_017", "askForInfo", "  ");
    const asked = await gw.reviewClaim("clm_017", "askForInfo", "Please add a screenshot of the answer.");
    const resumeTooSoon = await gw.reviewClaim("clm_017", "startReview", "");
    check("demo reviewer: start review, ask for info (needs a note), and can't resume before evidence",
      started.ok && started.claim.status === "inReview" && !!started.claim.reviewer &&
        !noNote.ok && noNote.error.kind === "validation" &&
        asked.ok && asked.claim.status === "needsInfo" &&
        !resumeTooSoon.ok && resumeTooSoon.error.kind === "invalidTransition");

    later(3);
    const noChange = await gw.reviewClaim("clm_015", "accept", "", " ");
    const accepted = await gw.reviewClaim("clm_015", "accept", "", "Assistant C now shows the pack in stock.");
    check("accept needs whatChanged; then sets resolvedAt and the resolution",
      !noChange.ok && noChange.error.kind === "validation" &&
        accepted.ok && accepted.claim.status === "accepted" && accepted.claim.reviewer?.name === "Marcus Webb" &&
        accepted.claim.resolution?.resolvedAt === accepted.claim.updatedAt &&
        accepted.claim.resolution?.whatChanged === "Assistant C now shows the pack in stock.");

    const all = await gw.listClaims();
    const hours = all.filter((c) => c.resolution).map((c) => (Date.parse(c.resolution!.resolvedAt) - Date.parse(c.filedAt)) / 3600_000).sort((a, b) => a - b);
    const mid = Math.floor(hours.length / 2);
    const manualMedian = hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
    const selectorMedian = medianTimeToResolveHours(all, new Date(t));
    check("median time to resolve updates from the timestamps after a new decision",
      hours.length === 13 && selectorMedian === manualMedian, `${selectorMedian?.toFixed(1)} h over ${hours.length} claims`);
    // 3 seeded + 3 filed (clm_017, clm_018, safety clm_019) - 1 withdrawn (clm_014) - 1 accepted (clm_015)
    check("outstanding and reviewed counts follow the changes (3 + 3 - 1 - 1 = 4 open; 12 + 1 = 13 reviewed)",
      outstandingCount(all) === 3 + 3 - 1 - 1 && reviewedCount(all, new Date(t)) === 12 + 1,
      `${outstandingCount(all)} outstanding, ${reviewedCount(all, new Date(t))} reviewed`);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
}

function sourceFiles(root: string): string[] {
  return ["app", "components", "lib"].flatMap((dir) => walk(path.join(root, dir)));
}

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

main();
