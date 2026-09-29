# Where data comes from

CIRQO is an API plugin for AI assistants plus a brand dashboard (DECISIONS.md #25). Every page calls
the backend through `lib/api.ts`, one typed function per `BACKEND_CONTRACT.md`
v1.1 endpoint. `NEXT_PUBLIC_USE_MOCK=true` reads the contract-named files in `shared/mock/`
(read-only); otherwise pages call `NEXT_PUBLIC_API_URL`. `npm run check:mock` shows which mock files exist.

| Page | Endpoints (DECISIONS.md #27) |
|------|------------------------------|
| Dashboard `/dashboard` | `GET /metrics/trust?days=30` |
| AI Visibility `/visibility` | `GET /visibility/summary`, `GET /answers` |
| Market Position `/market` | `competitors` in `GET /visibility/summary` |
| Assistant Simulator `/assistant` | `POST /connector/query` (v1.1), assistants from `GET /visibility/summary`. Always live. It reads `shared/mock/connector_query.json`, labeled "Mock data", only when mock mode is on. Allowed `useCase` / `mustHave` values live in `lib/connectorOptions.ts`. |
| File a Claim `/claims/new` | `POST /checker/run` (pasted answer or recorded `answerId`) |
| Outstanding Claims `/claims/outstanding` | `GET /incidents?status=pending_approval` and `status=escalated` |
| Claim detail `/claims/[id]` | `GET /incidents/{id}`, `POST .../approve`, `.../reject`, `.../resolve`, `GET /audit?targetId=` |
| Claims Reviewed `/claims/reviewed` | `GET /incidents` for `approved`, `rejected`, `resolved`, `auto_fixed`, plus `GET /audit` |
| Sidebar badge | open incidents = `pending_approval` + `escalated` |

Old routes redirect: `/` to `/dashboard` (home page, #29; the swipe funnel is dropped, #25), `/approvals` and
`/incidents` to `/claims/outstanding`, `/incidents/{id}` to `/claims/{id}`, `/audit` to
`/claims/reviewed`.

## Parked (no contract endpoint)

Growth Simulator and AI Coach have no contract endpoint, so they are out of the nav and have no
routes. Their code is kept for later: `components/screens/Growth.tsx`, `components/RevenueEstimate.tsx`,
`lib/coach/`, `lib/sample/`, `lib/simulator.ts`. `npm run check:sample` still checks that sample data.
This overrides decisions 11 and 27, which kept the coach as a frontend-only extra (user decision).
Per decision 28 their sample data is about Kestrel, the contract's brand (`lib/sample/sampleBusiness.ts`).

## Labeling rules (DECISIONS.md #12, #13)

- Every page shows a "Sample data" badge (sidebar). The user chip is sample-only and labeled.
- Mock connector answers are labeled "Mock data".
- AI Visibility Score = `round(visibilityRate x 100)`.

## NEEDS LEAD DECISION

- **Connector not live yet.** `POST /api/v1/connector/query` returns 404 on the live backend and
  `shared/mock/connector_query.json` doesn't exist yet. No frontend change is needed once either lands.
- **Extras parked** against decisions 11 and 27 (see "Parked" above).
- **Escalated incidents** can only be resolved by the owner (`POST .../resolve`), as in the contract.
