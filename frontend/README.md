# FrontDoor frontend

Next.js (App Router, TypeScript). Pages:

| URL | Page |
|-----|------|
| `/` | Shopper demo |
| `/dashboard` | Business dashboard |
| `/approvals` | Human approval queue |

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

All backend calls go through `lib/api.ts` (`apiGet`, `apiPost`, `checkHealth`). Endpoint
paths and response shapes come from `BACKEND_CONTRACT.md`; don't add endpoints that aren't in it.

In mock mode, pass the example file name: `apiGet(path, { mockFile: "name" })` reads
`shared/mock/name.json` through the read-only `/mock/[name]` route. The frontend never
writes to `shared/mock/`.

The footer calls the backend's `/health` on every page load and shows online/offline. The
backend must allow this site's address in its CORS settings.
