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
import { createClaimsGateway, storageKey } from "../lib/claims/gateway";
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
