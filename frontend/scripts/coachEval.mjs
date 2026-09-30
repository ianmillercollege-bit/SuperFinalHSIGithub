#!/usr/bin/env node
// Quality check for the live coach. Sends 30 judge-style questions (including off-topic and hostile ones) to the coach
// endpoint and reports how many answers were live and verified, how many fell back, latency, and simple content checks.
//
//   node scripts/coachEval.mjs                          # local dev server: http://localhost:3000/api/coach
//   node scripts/coachEval.mjs https://your-app.vercel.app/api/coach
//   node scripts/coachEval.mjs --pace 8000 --only growth,adversarial
//
// It calls the REAL model, so it uses credits (about 30 to 60 calls). It never prints or needs your key: the server holds it.
// Pace defaults to 7 s to stay under the route's 10-requests-per-minute limit.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const endpoint = args.find((a) => a.startsWith('http')) ?? 'http://localhost:3000/api/coach';
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const pace = Number(opt('pace', 7000));
const only = opt('only', '')?.split(',').filter(Boolean);
const context = JSON.parse(readFileSync(new URL('../coach-eval/context.json', import.meta.url), 'utf8'));
const all = JSON.parse(readFileSync(new URL('../coach-eval/questions.json', import.meta.url), 'utf8'));
const questions = all.filter((q) => !only?.length || only.includes(q.category));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (r) => [r.answer, ...(r.actions ?? []).flatMap((a) => [a.title, a.why, a.expectedImpact, ...(a.steps ?? [])]), ...(r.sources ?? []).map((s) => `${s.label}: ${s.value}`)].join(' ');

const rows = [];
console.log(`Endpoint: ${endpoint}\nQuestions: ${questions.length} (pace ${pace} ms)\n`);
for (const [i, item] of questions.entries()) {
  const t0 = Date.now();
  let row = { id: item.id, category: item.category, q: item.q, ms: 0, mode: 'error', verified: false, actions: 0, answer: '', note: '', checks: [] };
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: item.q, history: [], context }), signal: AbortSignal.timeout(60000) });
    row.ms = Date.now() - t0;
    if (!res.ok) { row.note = `HTTP ${res.status}`; }
    else {
      const r = await res.json();
      row = { ...row, mode: r.mode ?? r.source ?? '?', verified: !!r.verified, actions: (r.actions ?? []).length, answer: r.answer ?? '', note: r.note ?? '' };
      const all = text(r);
      if (item.mustMatch && !new RegExp(item.mustMatch, 'i').test(all)) row.checks.push(`missing /${item.mustMatch}/`);
      for (const bad of item.mustNotContain ?? []) if (all.includes(bad)) row.checks.push(`LEAK "${bad}"`);
      const data = !['offtopic', 'adversarial', 'ambiguous', 'outofdata', 'product'].includes(item.category);
      if (data && row.mode === 'live' && !/\d/.test(all)) row.checks.push('no numbers from the data');
      if (data && row.mode === 'live' && row.actions === 0) row.checks.push('no actions');
    }
  } catch (e) { row.ms = Date.now() - t0; row.note = e.name === 'TimeoutError' ? 'timeout (60 s)' : e.message; }
  rows.push(row);
  const flag = row.mode === 'live' && row.verified && !row.checks.length ? 'OK  ' : row.mode === 'live' ? 'WARN' : 'FALL';
  console.log(`${flag} #${String(row.id).padStart(2)} ${row.category.padEnd(11)} ${String(row.ms).padStart(6)} ms  ${row.mode.padEnd(8)} actions=${row.actions}  ${row.checks.join('; ')}${row.note ? `  [${row.note}]` : ''}`);
  console.log(`       Q: ${row.q}\n       A: ${row.answer.slice(0, 220).replace(/\s+/g, ' ')}${row.answer.length > 220 ? '...' : ''}\n`);
  if (i < questions.length - 1) await sleep(pace);
}
const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
const live = rows.filter((r) => r.mode === 'live' && r.verified).length, fb = rows.filter((r) => r.mode === 'fallback').length, err = rows.filter((r) => r.mode === 'error').length;
const warn = rows.filter((r) => r.mode === 'live' && r.checks.length).length;
console.log('SUMMARY');
console.log(`  live and verified: ${live}/${rows.length}    fell back to built-in: ${fb}    errors: ${err}    live with content warnings: ${warn}`);
console.log(`  latency: median ${ms[Math.floor(ms.length / 2)]} ms, slowest ${ms[ms.length - 1]} ms`);
console.log(`  READ THE ANSWERS ABOVE. This script checks safety and grounding, not whether the advice is good.`);
console.log(`  If most answers fall back, read the "note" (missing key, unverified numbers, limits) before judging day.`);
const file = new URL(`../coach-eval/results-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ endpoint, at: new Date().toISOString(), rows }, null, 2));
console.log(`  saved: ${file.pathname}`);
process.exit(err || fb > rows.length / 2 ? 1 : 0);
