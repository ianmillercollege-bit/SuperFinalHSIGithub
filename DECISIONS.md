# FrontDoor: Open Decisions (Brief Section 9)

Owner: Lead engineer. Last updated: 2026-09-29, 12:25 PM CT.

Values marked **PLACEHOLDER** are working defaults so the team can start. Replace them before
the final submission check. If this file and `BACKEND_CONTRACT.md` disagree, the contract wins.

| # | Decision | Value | Status |
|---|----------|-------|--------|
| 1 | School acronym | `SCHOOL` | **PLACEHOLDER. Must be the real acronym before submission. Wrong names are rejected.** |
| 2 | Repo link | https://github.com/ianmillercollege-bit/SuperFinalHSIGithub | Working repo. Final submission must be a public repo or zip named `<SchoolAcronym>_TECH_09302026`. Rename the repo or submit a zip before 6:00 AM CT 9/30. |
| 3 | AI provider and model | Anthropic, `claude-sonnet-5-5` | Decided. Used only in `backend/services/ai_client.py`, only for claim extraction and answer drafting.  `MOCK_MODE=true` stays default. |
| 4 | Frontend framework and Vercel URL | Next.js (React, TypeScript), dev on `localhost:3000`. Vercel URL: `https://frontdoor-SCHOOL.vercel.app` | Framework decided. URL is **PLACEHOLDER** until the frontend engineer's first Vercel deploy. |
| 5 | Backend live URL | `https://frontdoor-api-hiel.onrender.com` | Live, `/health` verified 9/29 afternoon. |
| 6 | Demo API keys (client API, not the AI key) | Owner: `fd_demo_owner_2026` / Viewer: `fd_demo_viewer_2026` | Decided. Demo-only values, safe to commit. They grant access to seeded demo data only. The Anthropic API key is never written anywhere in the repo. |
| 7 | Severity for an invented feature (hallucinated spec) | `high` | Decided. Goes to a named human for approval, never auto-fixed. |
| 8 | Detecting unfair comparisons and safety or legal claims in mock mode | Plain-code rules, no AI. See "Mock-mode detection rules" below. | Decided. |
| 9 | Client API (Part I) in scope? | In scope as a read-only subset. **Cut if not working by checkpoint hour 13.** | Decided. |
| 10 | Proof of impact | 30-day accuracy trend only. On/off comparison is a stretch goal, first thing cut. | Decided. |

## Mock-mode detection rules (decision 8)

Seeded AI answers are already split into claims. Plain code classifies each claim:

- **Unfair comparison** (severity `high`, human approval): the claim names a competitor brand from
  the seeded competitor list AND contains a comparative phrase (`better than`, `worse than`,
  `unlike`, `beats`, `outperforms`, `cheaper than`, `more reliable than`) AND no verified
  comparison fact supports it.
- **Safety or legal** (escalate only, never auto-fixed, never auto-approved): the claim contains a
  keyword from a fixed list (`safe for`, `certified`, `FDA`, `UL listed`, `recall`, `lawsuit`,
  `warranty`, `compliant`, `child-safe`, `medical`, `lifetime guarantee`).
- The exact keyword lists live in one constants file in `backend/` so they can be shown to judges.

## Clock-time schedule (we are starting late)

It is 9/29 afternoon. The tech submission is due **6:00 AM CT 9/30** (the tech instructions say
7:00 AM ET). There are about 17.5 hours left, not 24, so the checkpoints are compressed:

| Checkpoint | Target (CT) |
|------------|-------------|
| Backend on Render with `/health`, CORS, `.env.example` | 2:30 PM 9/29 |
| One mock JSON per endpoint in `shared/mock/` | 3:30 PM 9/29 |
| Seed data loading, shopper funnel in mock mode | 6:30 PM 9/29 |
| Business and marketing plan submitted | **9:00 PM 9/29** |
| Checker, dashboard, governance endpoints in mock mode | 10:30 PM 9/29 |
| Report, client API subset, tests passing | 1:30 AM 9/30 |
| Optional live AI behind `MOCK_MODE=false` | 2:30 AM 9/30 (skip if behind) |
| Code freeze, bug fixes only | 3:30 AM 9/30 |
| Final checks, repo naming, README, run.sh, upload | 4:00 to 5:30 AM 9/30 |
| Hard deadline | **6:00 AM CT 9/30** |

## Added 2026-09-29, 2:40 PM CT (lead approved)

| # | Decision | Value |
|---|----------|-------|
| 11 | Frontend extras (overview, market, opportunities, revenue simulator, coach chatbot) | **Kept, frontend-only, on the frontend's own sample data.** No new backend endpoints. The coach uses pre-written answers and says so on screen. |
| 12 | Honest labeling | Every screen shows a "Sample data" badge. Revenue is labeled "Illustrative estimate" with its assumptions visible. README and pitch state results are simulated. |
| 13 | AI Visibility Score | Display rule only: `round(visibilityRate x 100)`. No new API field. |
| 14 | Reason codes | Frontend uses the contract's `ruleId` list, not its own codes. |
| 15 | Frontend priority | Core screens first (shopper demo, incidents, approvals, audit log, 30-day trust chart), extras after. |
| 16 | Seed data ownership | ~~Lead owns `backend/seed/`~~ **Reassigned 3:15 PM CT: backend engineer owns `backend/seed/`** on branch `backend/seed-data`. Lead focuses on hosting, README, run.sh, smoke_test.sh and submission. |
| 17 | Seed data hand-off format | `backend/seed/generate.py` writes JSON files to `backend/seed/data/`: `brands.json`, `products.json`, `assistants.json`, `sources.json`, `owners.json`, `answers.json`, `claims.json`, `incidents.json`, `audit.json`, `daily_metrics.json`. Same camelCase shapes as the contract, plus seed-only fields (`isClient`, `billingTier` on brands, `priceHistory` on products). The backend loads these into SQLite on startup. Due 6:30 PM CT. |
