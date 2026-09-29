# CIRQO frontend

Next.js (App Router, TypeScript). **All results shown are seeded or simulated demo data**, labeled
"Sample data" on every page. Revenue figures are illustrative estimates, and the coach gives
pre-written demo answers.

| URL | Screen |
|-----|--------|
| `/dashboard` | Dashboard with the 30-day trust chart |
| `/opportunities` | Opportunity Gaps (placeholder) |
| `/simulator` | Growth Simulator (sample business, illustrative revenue estimate) |
| `/coach` | AI Coach (pre-written demo answers) |
| `/claims/new`, `/claims/outstanding`, `/claims/reviewed` | Claims section (placeholders) |
| `/` | Shopper demo (not in the nav) |

Navigation is defined once in `lib/nav.ts`.

See `INTEGRATION.md` for where data comes from.

## Run locally

```bash
cd frontend
npm install
cp .env.example .env.local   # then edit the values
npm run dev                  # http://localhost:3000
```

`npm run build` checks that everything compiles.

## Settings

| Variable | Meaning |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend address, no trailing slash. |
| `NEXT_PUBLIC_USE_MOCK` | `true` loads example data from `shared/mock/` instead of the live backend. |

Both are baked in at build time: restart `npm run dev` (or redeploy) after changing them.

## Talking to the backend

All backend calls go through `lib/api.ts`, one typed function per contract endpoint
(`getIncidents`, `approveIncident`, `getReport`, ...), with types in `lib/types.ts`.
`npm run check:mock` shows which `shared/mock/` files have arrived. Endpoint
paths, fields and types come from `BACKEND_CONTRACT.md`; don't add anything that isn't in it.
Failed calls throw `ApiError` with the contract's error `code` and `message`.

Rates arrive as 0 to 1; show them with `formatPercent()` from `lib/format.ts`.

In mock mode each function reads its contract-named file from `shared/mock/` (for example
`incidents.json`) through the read-only `/mock/[name]` route, and applies the same filters the
backend would. The frontend never writes to `shared/mock/`.

The footer calls the backend's `/health` on every page load and shows online/offline. The
backend must allow this site's address in its CORS settings.
