# Where data comes from

## Core screens (contract data)

Shopper demo, trust dashboard, incidents, approvals, and audit log call the typed functions in
`lib/api.ts`, one per `BACKEND_CONTRACT.md` endpoint. `NEXT_PUBLIC_USE_MOCK=true` reads the
contract-named files in `shared/mock/` (read-only); otherwise they call `NEXT_PUBLIC_API_URL`.
`npm run check:mock` shows which mock files exist.

## Extras (frontend-only sample data, DECISIONS.md #11)

The Growth page (score, revenue estimate, coach) uses the frontend's own sample business and has no
backend endpoints. To plug in real data later, change only `lib/dataSource.ts` (views) or the
`coach` provider in `lib/coach/index.ts`. Pages don't change.

| What | File |
|------|------|
| Business name, category, region | `lib/sample/sampleBusiness.ts` (the only place the name is written) |
| Prompts, assistants, who appeared and why (contract `ruleId`s, #14) | `lib/sample/visibility.ts` |
| Plain-English reason per `ruleId`, linked to an opportunity | `lib/sample/ruleReasons.ts` |
| Opportunities (lift points, effort, steps) | `lib/sample/opportunities.ts` |
| Past weekly scores | `lib/sample/overview.ts` |
| Competitors and similar businesses | `lib/sample/market.ts` |
| Revenue assumptions | `lib/config/simulatorAssumptions.ts` |
| Coach questions and answer templates | `lib/coach/sampleCoach.ts` |

Summary numbers are calculated in `lib/sample/derive.ts`, never typed twice. Run
`npm run check:sample` after any edit.

## Labeling rules (DECISIONS.md #12, #13)

- Every page shows a "Sample data" badge (in `components/NavBar.tsx`).
- Revenue is only shown through `components/RevenueEstimate.tsx`, labeled "Illustrative estimate"
  with its assumptions. Coach answers label dollar amounts the same way.
- The coach states it gives pre-written demo answers.
- AI Visibility Score = `round(visibilityRate x 100)`.

## Still unconfirmed in the contract

- A correct claim's `ruleId`, and an answer's `rank` when the brand isn't mentioned: typed as nullable.
- "Open" incidents: treated as `resolvedAt === null`.
