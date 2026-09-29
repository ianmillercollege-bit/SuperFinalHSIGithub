# Seed data

Owned by the backend engineer (reassigned by the lead, overriding DECISIONS.md #16).

`generate.py` writes the full demo data set to `data/` (the 10 files in DECISIONS.md #17).
The backend loads `data/` into SQLite on every startup.

```bash
python backend/seed/generate.py
```

- **Deterministic:** fixed random seed and reference date, so every run gives identical files.
  The backend shifts dates on load so the 30-day trend always ends today.
- **Consistent with `shared/mock/`:** the catalog, owners, sources, trend and every example
  answer, claim and incident come from the mock files unchanged. Older history is added around them.
- **Agrees with the checker:** generated claims come from running `services/checker.py` on the
  generated answers, so re-checking a seeded answer finds nothing new.
- **All fictional:** brands Kestrel (client), Arcton and Novex; Assistants A, B and C (simulated).

`backend/tests/test_seed_data.py` checks every BACKEND_CONTRACT.md section 9 minimum and fails
if `data/` is out of date with `generate.py`. After changing `generate.py` or `shared/mock/`,
rerun the generator and commit `data/`.
