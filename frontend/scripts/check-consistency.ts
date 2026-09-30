// Checks that every screen shows the same figure for the same thing, against the live backend.
// Run: NEXT_PUBLIC_API_URL=https://frontdoor-api-hiel.onrender.com npx tsx scripts/check-consistency.ts
import { getAnswers, getIncidents, getTrustMetrics, getVisibilitySummary } from "../lib/api";
import { contextFromKit } from "../lib/coach/contextFromKit";
import { liveCoachInputs, withLiveVisibility } from "../lib/coach/session";
import { ANSWERS_LIMIT, liveVisibility } from "../lib/dashboard/liveVisibility";
import { toViewModel } from "../lib/dashboard/toViewModel";
import { DEFAULT_ASSUMPTIONS, simulate } from "../lib/screens/simulate";
import { liveMarketProps, liveVisibilityProps } from "../lib/screens/liveVisibilityMarket";
import { sampleOpportunities } from "../lib/screens/samples";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  const [trust, summary, answersRes, pending, escalated] = await Promise.all([
    getTrustMetrics(30), getVisibilitySummary(30), getAnswers({ limit: ANSWERS_LIMIT }),
    getIncidents({ status: "pending_approval", limit: 100 }), getIncidents({ status: "escalated", limit: 100 }),
  ]);
  const answers = answersRes.answers;
  const open = pending.incidents.length + escalated.incidents.length;
  const vm = toViewModel({ firstName: "Test", businessName: summary.brandName, trust, claims: { open, pending: pending.incidents.length, decided: 27, decidedCapped: false }, audit: [], visibility: { summary, answers } });
  const live = liveVisibility(summary, answers);
  const base = contextFromKit({ businessName: summary.brandName, vm, opportunities: sampleOpportunities, live: liveCoachInputs(trust, { open, decided: 27 }) });
  const ctx = withLiveVisibility(base, live, vm.score?.changeVsLastWeek ?? 0);
  const market = liveMarketProps(summary, summary.brandName);
  const vis = liveVisibilityProps(summary, answers);
  const youRow = market.rows.find((r) => r.group === "you")!;
  const stat = (id: string) => vm.stats.find((s) => s.id === id);

  console.log(`\nlive: rate ${summary.visibilityRate}, ${live.recommended} of ${live.tested} answers, answers truncated: ${live.truncated}`);
  check("answers list is complete (below the API row limit)", !live.truncated, `${answers.length} rows`);
  check("counts reproduce the summary rate", Math.round((live.recommended / live.tested) * 100) === Math.round(summary.visibilityRate * 100), `${live.recommended}/${live.tested}`);
  check("dashboard score = score from the summary (decision 13)", vm.score!.value === Math.round(summary.visibilityRate * 100), String(vm.score!.value));
  check("Market Position 'you' score = dashboard score", youRow.score === vm.score!.value, `${youRow.score}`);
  check("coach visibility score = dashboard score", ctx.visibility!.score === vm.score!.value, `${ctx.visibility!.score}`);
  check("dashboard recommendation frequency = summary rate", stat("frequency")!.value === `${Math.round(summary.visibilityRate * 100)}%`, stat("frequency")!.value);
  check("coach recommendation frequency = summary rate", Math.round(ctx.visibility!.recommendationFrequency * 100) === Math.round(summary.visibilityRate * 100));
  check("dashboard frequency note counts = coach counts", stat("frequency")!.note === `${ctx.visibility!.answersRecommended} of ${ctx.visibility!.answersTested} recorded answers, last ${summary.periodDays} days`, stat("frequency")!.note);
  check("AI Visibility 'missed' stat = coach missed", vis.stats.find((s) => s.id === "missed")!.value === String(ctx.visibility!.answersMissed), String(ctx.visibility!.answersMissed));
  check("AI Visibility 'frequency' = summary rate", vis.stats.find((s) => s.id === "freq")!.value === `${Math.round(summary.visibilityRate * 100)}%`);
  const perPoint = simulate(vm.score!.value, [], {}, DEFAULT_ASSUMPTIONS).perPoint;
  check("dashboard revenue estimate = score x revenue per point", stat("revenue")!.value === `$${Math.round(vm.score!.value * perPoint).toLocaleString("en-US")}`, stat("revenue")!.value);
  check("coach revenue = dashboard revenue", `$${ctx.revenue!.estimatePerMonth.toLocaleString("en-US")}` === stat("revenue")!.value, String(ctx.revenue!.estimatePerMonth));
  check("coach claims = dashboard claim cards", ctx.claims!.outstanding === Number(stat("outstanding")!.value) && String(ctx.claims!.reviewedLast30Days) === stat("reviewed")!.value.replace("+", ""));
  check("coach trust = live trust", ctx.trust!.accuracyRate === Math.round(trust.current.accuracyRate * 100) / 100 && ctx.trust!.hallucinationRate === Math.round(trust.current.hallucinationRate * 100) / 100);
  check("dashboard accuracy card = live trust", stat("accuracy")!.value === `${Math.round(trust.current.accuracyRate * 100)}%`, stat("accuracy")!.value);
  check("coach rank = Market Position rank", ctx.market!.rankOverall === [...market.rows].sort((a, b) => b.score - a.score).findIndex((r) => r.group === "you") + 1 || market.rows.filter((r) => r.score > youRow.score).length + 1 === ctx.market!.rankOverall, `${ctx.market!.rankOverall} of ${ctx.market!.businessCount}`);
  check("coach business count = Market Position rows", ctx.market!.businessCount === market.rows.length);
  check("coach competitors = Market Position competitors (names and scores)", JSON.stringify(ctx.competitors!.map((c) => [c.name, c.score])) === JSON.stringify(market.rows.filter((r) => r.group !== "you").map((r) => [r.name, r.score])));
  check("coach share of voice = Market Position", Math.round(ctx.market!.shareOfVoice * 100) === Math.round(youRow.shareOfVoice * 100));
  check("coach assistants = summary assistants", JSON.stringify(ctx.assistants!.map((a) => [a.name, Math.round(a.frequency * 100)])) === JSON.stringify(summary.byAssistant.map((a) => [a.name, Math.round(a.visibilityRate * 100)])));
  check("per-assistant counts reproduce each summary rate", live.assistants.every((a) => a.tested > 0 && Math.abs(a.recommended / a.tested - a.frequency) < 0.006), live.assistants.map((a) => `${a.name} ${a.recommended}/${a.tested} vs ${a.frequency}`).join("; "));
  check("coach opportunities = dashboard opportunities", JSON.stringify(ctx.opportunities!.map((o) => [o.title, o.liftPoints, o.revenuePerMonth])) === JSON.stringify(vm.opportunities!.map((o) => [o.title, o.liftPoints, o.revenuePerMonth])));
  const lift = vm.opportunities!.reduce((s, o) => s + o.liftPoints, 0), money = vm.opportunities!.reduce((s, o) => s + o.revenuePerMonth, 0);
  check("opportunity revenue = lift points x revenue per point", Math.abs(money - lift * perPoint) < 1, `${money} vs ${Math.round(lift * perPoint)}`);
  // The retired names are built from pieces so this file does not contain them itself.
  const sampleNames = new RegExp(["Assistant D", "Lakeshore", ["Har", "bor"].join(""), ["Juni", "per"].join("")].join("|"));
  check("no sample names in the coach context", !sampleNames.test(JSON.stringify(ctx)), "");
  check("derived facts quote the live score", ctx.derivedFacts!.some((f) => f.includes(`to ${vm.score!.value} last week`)), ctx.derivedFacts!.find((f) => f.includes("last week")) ?? "");
  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll consistency checks passed.");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
