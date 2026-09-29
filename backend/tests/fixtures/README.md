# Test fixtures

A small seed set used only by the tests (`conftest.py` points `SEED_DIR` here). It has the
same file list and shapes as `backend/seed/data/` (DECISIONS.md #17): camelCase contract
shapes plus the seed-only fields `isClient`, `billingTier` (brands) and `priceHistory`
(products). The data matches `shared/mock/`.

The running server never loads this folder unless `SEED_DIR` is set to it.
