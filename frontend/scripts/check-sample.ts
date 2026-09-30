// npm run check:sample
// Verifies the sample data is complete and consistent, the simulator hits its
// anchors, and the coach answers every suggested question. (Type checking
// against lib/schema.ts runs first, via tsc, in the npm script.)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { simulatorAssumptions } from "../lib/config/simulatorAssumptions";
import { STARTERS } from "../components/coach/CoachPage";
import { sampleCoach } from "../lib/coach/sampleCoach";
import { coachBanner } from "../lib/coach/useCoachChat";
import { contextFromKit } from "../lib/coach/contextFromKit";
import { sampleDashboard } from "../lib/dashboard/sampleDashboard";
import { sampleOpportunities } from "../lib/screens/samples";
import { getOverview } from "../lib/dataSource";
import {
  buildMarketReport,
  buildOpportunitiesReport,
  buildOverview,
  buildSimulatorBaseline,
  buildVisibilityReport,
  visibilityScoreFromRate,
} from "../lib/sample/derive";
import { BUSINESS } from "../lib/business";
import { allLeversOn, simulate } from "../lib/simulator";

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

  section("Coach (kit, sample mode)");
  const coachContext = contextFromKit({ businessName: BUSINESS.name, vm: sampleDashboard, opportunities: sampleOpportunities, dataLabel: "sample" });
  for (const { question } of STARTERS) {
    const reply = await sampleCoach.ask({ question, history: [], context: coachContext });
    check(`"${question}"`, reply.mode === "sample" && reply.answer.length > 0 && reply.sources.length > 0, `mode ${reply.mode}, ${reply.sources.length} sources`);
  }
  check("the coach banner says it is a pre-written demo answer (decision 11)", coachBanner(false) === "Demo: pre-written answers, not a live AI.");

  section("Business name (DECISIONS.md #28)");
  check("the business is Kestrel (brand_001), the contract's brand", BUSINESS.name === "Kestrel" && BUSINESS.id === "brand_001");
  // The two retired names are built from pieces so this file does not contain them itself.
  const retired = [["Juni", "per Trail"], ["Har", "bor Home"]].map((parts) => new RegExp(parts.join(""), "i"));
  const oldNames = sourceFiles(path.join(__dirname, "..")).filter((f) => retired.some((r) => r.test(readFileSync(f, "utf8"))));
  check("the two retired business names appear nowhere in frontend/", oldNames.length === 0, oldNames.join(", "));
  const offenders = sourceFiles(path.join(__dirname, ".."))
    .filter((f) => !f.endsWith("business.ts") && !f.endsWith("demoAccountsFallback.ts") && !f.endsWith("samples.ts") && !f.endsWith("visibilityMarket.ts")) // contract 7b example accounts; the UI kit's untouched sample data
    .filter((f) => readFileSync(f, "utf8").includes(BUSINESS.name));
  const libOffenders = offenders.filter((f) => f.includes(`${path.sep}lib${path.sep}`));
  check("everything in lib/ takes the name from lib/business.ts", libOffenders.length === 0, libOffenders.join(", "));

  console.log(failures === 0 ? "\nAll sample checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
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
