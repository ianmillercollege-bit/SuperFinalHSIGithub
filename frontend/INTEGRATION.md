# Where data comes from

CIRQO is an API plugin for AI assistants plus a brand dashboard (DECISIONS.md #25). Every page except
the two extras calls the backend through `lib/api.ts`, one typed function per `BACKEND_CONTRACT.md`
v1.1 endpoint. `NEXT_PUBLIC_USE_MOCK=true` reads the contract-named files in `shared/mock/`
(read-only); otherwise pages call `NEXT_PUBLIC_API_URL`. `npm run check:mock` shows which mock files exist.

| Page | Endpoints (DECISIONS.md #27) |
|------|------------------------------|
| Dashboard `/dashboard` | `GET /metrics/trust?days=30` |
| AI Visibility `/visibility` | `GET /visibility/summary`, `GET /answers` |
| Market Position `/market` | `competitors` in `GET /visibility/summary` |
| Assistant Simulator `/assistant` | `POST /connector/query` (v1.1), assistants from `GET /visibility/summary` |
| File a Claim `/claims/new` | `POST /checker/run` (pasted answer or recorded `answerId`) |
| Outstanding Claims `/claims/outstanding` | `GET /incidents?status=pending_approval` and `status=escalated` |
| Claim detail `/claims/[id]` | `GET /incidents/{id}`, `POST .../approve`, `.../reject`, `.../resolve`, `GET /audit?targetId=` |
| Claims Reviewed `/claims/reviewed` | `GET /incidents` for `approved`, `rejected`, `resolved`, `auto_fixed`, plus `GET /audit` |
| Sidebar badge | open incidents = `pending_approval` + `escalated` |

Old routes redirect: `/` to `/dashboard` (the swipe funnel is dropped, #25), `/approvals` and
`/incidents` to `/claims/outstanding`, `/incidents/{id}` to `/claims/{id}`, `/audit` to
`/claims/reviewed`, `/growth` to `/simulator`.

## Extras (frontend-only sample data, DECISIONS.md #11)

Growth Simulator (`/simulator`) and AI Coach (`/coach`) use the frontend's own sample business and
have no backend endpoints. Sample data lives in `lib/sample/`; summary numbers are derived in
`lib/sample/derive.ts`. Run `npm run check:sample` after any edit.

## Labeling rules (DECISIONS.md #12, #13)

- Every page shows a "Sample data" badge (sidebar). The user chip is sample-only and labeled.
- Revenue is only shown through `components/RevenueEstimate.tsx`, labeled "Illustrative estimate".
- The coach states it gives pre-written demo answers.
- AI Visibility Score = `round(visibilityRate x 100)`.

## NEEDS LEAD DECISION

- **Connector not live yet.** `POST /api/v1/connector/query` returns 404 on the live backend and
  `shared/mock/connector_query.json` doesn't exist yet. The Assistant Simulator shows an honest
  "not available yet" message until one of them lands; no frontend change is needed after that.
- **Business names.** The extras use Juniper Trail Outfitters (`lib/sample/sampleBusiness.ts`);
  contract data is Kestrel. `lib/sample/visibilityMarket.ts` (Harbor Home Goods) is no longer used,
  because AI Visibility and Market Position now use the contract endpoints (#27).
- **Escalated incidents** can only be resolved by the owner (`POST .../resolve`), as in the contract.
