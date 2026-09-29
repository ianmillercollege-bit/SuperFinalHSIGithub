# dev_seed (temporary stand-in)

The real seed data belongs to the lead: `backend/seed/generate.py` writes JSON to
`backend/seed/data/` (DECISIONS.md #16 and #17). The backend loads that folder automatically
as soon as it has a `products.json`.

Until then, the backend loads this folder instead, so it can be built and tested. It holds
the same fictional data as `shared/mock/`, in the #17 file format (camelCase contract shapes
plus the seed-only fields `isClient`, `billingTier` and `priceHistory`).

Delete this folder once `backend/seed/data/` is merged, or keep it for tests.
You can also point the backend at any folder with the `SEED_DIR` environment variable.
