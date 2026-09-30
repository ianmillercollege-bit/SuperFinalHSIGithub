# CIRQO: Open Decisions (Brief Section 9)

Owner: Lead engineer. Last updated: 2026-09-29, 12:25 PM CT.

Values marked **PLACEHOLDER** are working defaults so the team can start. Replace them before
the final submission check. If this file and `BACKEND_CONTRACT.md` disagree, the contract wins.

| # | Decision | Value | Status |
|---|----------|-------|--------|
| 1 | School acronym | `UTSA` | Decided. Tech submission name: `UTSA_TECH_09302026`. |
| 2 | Repo link | https://github.com/ianmillercollege-bit/UTSA_TECH_09302026 | Renamed to `UTSA_TECH_09302026`. Must be **public** before 6:00 AM CT 9/30. |
| 3 | AI provider and model | Anthropic, `claude-sonnet-5-5` | Decided. Used only in `backend/services/ai_client.py`, only for claim extraction and answer drafting.  `MOCK_MODE=true` stays default. |
| 4 | Frontend framework and Vercel URL | Next.js (React, TypeScript), dev on `localhost:3000`. Vercel URL: `https://super-final-hsi-github.vercel.app` | Live. |
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
| 18 | Product and company name | **CIRQO** (was FrontDoor). Rename all user-facing text: app title, nav, page headings, API docs title, README, pitch. **Do not change** technical identifiers: API paths, field names, demo keys (`fd_demo_owner_2026`, `fd_demo_viewer_2026`), environment variable names, or the Render and Vercel URLs. The competition theme "The New Front Door" stays as written. |

## Added 2026-09-29, 4:40 PM CT: alignment with the 5-Page Business Plan (`UTSA_5PBP_09292026.pdf`)

| # | Decision | Value |
|---|----------|-------|
| 19 | Business plan is the business source of truth | Where the tech solution and the plan describe the same thing, they must use the same words. Plan terms: **Shopping Connector** (shopper demo), **Visibility and Accuracy Dashboard** (dashboard, incidents, approvals, audit), **Verified Data Layer** (verified product facts), **"verification pending"** (an incident waiting for a person), success metrics **AI-answer inclusion rate** and **claim accuracy rate**. README and COVER_PAGE.md updated. |
| 20 | Team on cover page | Ian Miller, Zain Imam, Eniyan Aravindan, Aditya Ballal, Matthew Hernandez, Abraham Ly (from the plan's cover page). |
| 21 | **LEAD DECISION NEEDED: pricing fixes** | Plan 5.1 says "any modification to pricing" requires human review first. Tech (contract section 6) auto-fixes price errors under 15%. Pick one: (a) business team narrows the plan wording to "price corrections above 15%", or (b) backend makes `PRICE_MISMATCH` and `PRICE_OUTDATED` always `human_approval`. |
| 22 | **LEAD DECISION NEEDED: sponsored slots** | Plan 4 lists "labeled sponsored slots (optional, later)" as secondary revenue. Brief and tech: brands can never pay for placement, and a test proves ranking ignores billing. Recommend the business team removes sponsored slots or states they never affect recommendations. |
| 23 | **LEAD DECISION NEEDED: owner roles** | Plan 5.1 names three accountable roles: Brand Data Owner, CIRQO Trust and Safety Lead, CIRQO Product Owner. Seed owners are Pricing Manager, Product Content Lead, Legal and Compliance. Recommend renaming seed roles to the plan's three (backend change, names can stay). |
| 24 | **LEAD DECISION NEEDED: product name spelling** | Plan uses "CIRQO AI", "CIRQOAI", "CirqoAI" and "Cirqo AI". Tech uses "CIRQO". Pick one spelling for both. |
| 25 | **Product framing (lead, 5:05 PM CT)** | CIRQO is an **API plugin for AI assistants plus a brand dashboard**. A brand connects its catalog; when a shopper asks ChatGPT or Claude a shopping question, the assistant calls CIRQO (`POST /api/v1/connector/query`) and answers from verified facts; CIRQO records the interaction and the brand sees inclusion, wrong claims, sources and approvals in the dashboard. **There is no consumer shopping app.** The swipe funnel is dropped from the frontend; the shopper endpoints stay in the backend as legacy. The frontend gets one **Assistant simulator** page that shows a judge what the assistant receives from the connector. Contract v1.1 adds the Connector endpoint and manifest. |
| 26 | Frontend redesign | Approved (sidebar, brand tokens, Claims section). Rule: `main` always works. Nothing merges until the new site does: dashboard with 30-day trend, Outstanding Claims with approve/reject, Claims Reviewed with audit history, File a Claim posting to the checker, Assistant simulator, "Sample data" badge everywhere. Checkpoint 11:00 PM CT, hard merge deadline 1:00 AM CT. |
| 27 | **No new endpoints beyond contract v1.1** (answer to frontend INTEGRATION.md) | The Claims pages use the existing governance endpoints: Outstanding Claims = `GET /incidents?status=pending_approval` plus `status=escalated`, with `POST .../approve`, `.../reject`, `.../resolve`; Claims Reviewed = `GET /audit` plus incidents with `status` in `approved`, `rejected`, `resolved`, `auto_fixed`; File a Claim = `POST /checker/run`. AI Visibility page = `GET /visibility/summary` plus `GET /answers`. Market Position page = the `competitors` list in `GET /visibility/summary`. Coach stays frontend-only sample (decision 11). No users or sign-in in scope; the user chip is sample-only and labeled. Reason labels = the contract `ruleId` list (decision 14); anything not in that list is dropped. Contract clarified: a `correct` claim has `ruleId: null`; `rank` is `null` when `brandMentioned` is false; open = `pending_approval` or `escalated`. |
| 28 | Demo brand everywhere (lead, 5:35 PM CT) | The extras (Growth Simulator, AI Coach) use **Kestrel**, the same fictional brand as the contract data. "Juniper Trail Outfitters" and "Harbor Home Goods" are removed. |
| 29 | Home page | `/` goes straight to the dashboard. The swipe funnel is gone from the frontend (decision 25). |
| 30 | **Evening slate (lead, 6:10 PM CT)** | Approved: (1) brand accounts with three demo logins and `brandId` scoping, (2) "Connect your catalog" onboarding, (3) turn on live AI after testing, (4) second product category if time allows, (5) downloadable brand report. Contract v1.3 (section 7b) covers 1 and 2. Rules: backward compatible (no brand = Kestrel), `main` stays green, **anything not merged by 1:30 AM CT is cut.** |
| 31 | Two sign-in layers, both kept (lead, 7:30 PM CT) | **Brand account** (which company): backend v1.3 demo accounts and `brandId` scoping, chosen at `/login`. **Person within the brand** (who is approving): frontend-only sample sign-in with the seeded owners and a read-only Viewer, pre-filling the approver name; the Viewer restriction is a frontend hide, not security, and is labeled as sample. No account chosen = Kestrel, first visit lands on the dashboard (decision 29). Note: a parallel lead session numbered its sign-in notes 30 to 32 on branch `claude/compassionate-meitner-3btins`; this row supersedes them on `main`. |
| 32 | "Preview as shopper" (lead, 7:45 PM CT) | The Assistant Simulator comes back as a **brand-facing** feature named **Preview as shopper** (route `/preview`, under Insights). A brand uses it to see what a shopper's AI assistant answers from the brand's verified catalog, to check a launch, understand why a competitor wins a question, or reproduce a complaint. Shoppers never see it. Every preview is recorded and appears in AI Visibility. Supersedes the deletion in commit `dcbc499`. |
| 33 | **Night slate (lead, 7:55 PM CT)** | Approved over the assistant's caution: (1) real username and password login, every demo password `cirqo-demo`, demo usernames printed on the login page, plus a "Continue as guest (Kestrel)" link so judges can never be locked out; (2) catalog at scale: 30 companies with CEOs and admins, 5 categories, about 1,200 products, every company with dashboard data, database rebuild under 10 s; (3) conversational connector: `POST /connector/search` with narrowing hints, MCP v2 tools that make the assistant run the funnel; (4) CIRQO Staff role with a cross-company oversight view. Contract v1.4, section 7c. Rules unchanged: backward compatible, `main` stays green, **unmerged at 1:30 AM CT is cut**, freeze 3:30 AM. |
| 34 | Catalog source (lead, 8:10 PM CT) | The backend engineer's spreadsheet `Greek_God_Tech_Companies.xlsx` (150 fictional companies, 4 categories, 1,500 products, verified comparisons, admin emails) is the catalog source of truth, committed at `backend/seed/source/`. Contract v1.4.1 follows its categories and spec columns. Its temporary passwords are ignored: **every demo password stays `cirqo-demo`** so judges are never locked out. Real component names inside fictional products (Ryzen, Core, RTX) are allowed. Rebuild-time test decides how many companies get full dashboard data. |
| 35 | Plugin is for the shopper; opted-in vs not (lead, 9:30 PM CT) | The shopper enables CIRQO in their assistant for accurate, personalized answers. The catalog holds **both opted-in brands** (verified facts, dashboards, admins) and **not-opted-in brands** (public-listing facts labeled "not verified by the brand", no dashboard). Ranking treats both alike on fit; only the verified label differs. Not-opted-in brands can **claim their company** to opt in. **No real company names**, ever: inventing facts about a real company is the exact harm the case is about; the 150 fictional companies are split 60 opted in / 90 not. Contract v1.5, section 7d. |
| 36 | Community program (lead, 9:55 PM CT) | Companies pledge surplus and refurbished units; **Community Partner** organizations (fictional school district, veterans network, nonprofit) log in to a cross-company catalog of pledged units with verified facts and request them; brands approve by a named owner. **CIRQO never verifies an individual's income or need and stores no recipient data**; partners do the targeting. Contract v1.6, section 7e. Priority: after catalog, login and search; built in a separate backend session on its own files. Cut if unmerged at 1:30 AM. |
| 37 | Parallel backend sessions | Allowed. Each session owns distinct files (catalog: `seed/generate.py` and product model; search: `routers/connector.py`, `services/search.py`; community: `routers/community.py`, `services/community.py`, `seed/data/community.json`), merges `origin/main` before pushing, and the lead merges in the order catalog, auth, search, community. |
| 38 | Deploy note (10:15 PM CT) | Live site was found serving a build older than `main` (no `/preview`, `/company`, `/products`). Cause: production alias pointed at an older deployment. Fix: fresh push to `main` triggers a new production deploy; verify with `SUBMISSION_CHECKLIST.md` live checks. Rule: never click Redeploy on an old Vercel deployment; use "Promote to Production" on the newest one instead. |
