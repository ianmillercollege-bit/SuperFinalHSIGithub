# FrontDoor Client API Contract (Part I)

Status: **DRAFT v0.1** (lead engineer). Read-only subset. **Cut if not working by 1:30 AM CT 9/30.**
All rules from `BACKEND_CONTRACT.md` apply (camelCase, prefixed IDs, UTC timestamps, error shape).

## Purpose

The API a customer company calls from its own systems (for example, to pull FrontDoor numbers into
its own reports). It is read-only: approvals and fixes happen only in the FrontDoor dashboard,
so a named human is always accountable.

## Authentication

Send the key in a header on every request:

```
X-API-Key: fd_demo_owner_2026
```

| Key | Role | Can read |
|-----|------|----------|
| `fd_demo_owner_2026` | Owner | Every endpoint below |
| `fd_demo_viewer_2026` | Viewer | Visibility and trust metrics only |

These are demo-only keys for seeded data (see `DECISIONS.md`). They are unrelated to the AI provider key.

Errors: missing or unknown key → 401 `UNAUTHORIZED`. Viewer key on an owner-only endpoint → 403 `FORBIDDEN`.

## Endpoints

Each response is the **same shape** as the matching dashboard endpoint in `BACKEND_CONTRACT.md`,
so the backend should reuse the same code and models.

| Endpoint | Same shape as | Owner | Viewer |
|----------|---------------|-------|--------|
| `GET /api/v1/client/visibility?days=30` | `GET /api/v1/visibility/summary` | yes | yes |
| `GET /api/v1/client/metrics/trust?days=30` | `GET /api/v1/metrics/trust` | yes | yes |
| `GET /api/v1/client/incidents?status=&severity=&limit=` | `GET /api/v1/incidents` | yes | no |
| `GET /api/v1/client/audit?targetId=&limit=` | `GET /api/v1/audit` | yes | no |
| `GET /api/v1/client/report?days=30` | `GET /api/v1/report` | yes | no |

No write endpoints. Any other method on these paths → 405, returned in the standard error shape with code `BAD_REQUEST`.

## Required tests

`test_client_api_auth`: no key → 401, bad key → 401, viewer on `/client/incidents` → 403,
owner on every endpoint → 200, viewer on `/client/visibility` → 200.
