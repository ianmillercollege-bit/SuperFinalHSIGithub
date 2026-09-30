# CIRQO Backend Contract

Status: **FINAL v1.7** (approved by lead engineer, 2026-09-30; v1.7 implements section 7d (optedIn, verified, claim), adds `GET /products/{id}`, the remote MCP endpoint and a third MCP tool `cirqo_details`, and accepts each sheet company's own password alongside `cirqo-demo`, section 7c Login; v1.6 adds the Community program, section 7e; v1.5 adds opted-in vs not-opted-in brands, section 7d; v1.4.1 loads the catalog from the backend engineer's spreadsheet; v1.1 Connector, v1.2 Verified Data Layer fields, v1.3 brand accounts and onboarding, v1.4 login, company profiles, catalog at scale, connector search, section 7c). Any change to a path,
field name, or data type needs the lead's approval and an update here BEFORE code changes.
If this file and the brief disagree, this file wins. Decisions referenced here live in `DECISIONS.md`.

---

## 1. General rules

- Stack: Python 3.11, FastAPI, Uvicorn, Pydantic v2, SQLite via SQLAlchemy, pytest. Hosted on Render.
- Base path: `/api/v1` for everything except `GET /health`.
- JSON only. Field names are **camelCase** (Pydantic `alias_generator=to_camel`, `populate_by_name=True`).
- IDs are prefixed strings: `brand_001`, `prod_014`, `ast_02`, `ans_120`, `clm_300`, `src_03`,
  `inc_12`, `own_01`, `aud_501`, `fact_040`.
- Timestamps: ISO 8601 UTC with `Z`, for example `2026-09-29T17:05:00Z`. Dates: `2026-09-29`.
- Rates and scores are numbers from 0 to 1. Prices are numbers in US dollars (`449.99`) with `"currency": "USD"`.
- Lists are always wrapped in an object: `{"incidents": [...]}`, never a bare array.
- Optional query parameter `limit` on list endpoints: default 50, max 100. No other pagination.
- Every response that can include AI output has `"source": "live" | "mock" | "fallback"`.
- The dashboard and shopper demo endpoints need no auth. The client API (see `CLIENT_API_CONTRACT.md`) does.

## 2. Error format

Every error, including FastAPI's default 422, uses exactly this shape:

```json
{"error": {"code": "NOT_FOUND", "message": "Incident inc_99 does not exist."}}
```

| HTTP | code | When |
|------|------|------|
| 400 | `BAD_REQUEST` | Request is well-formed but not allowed (for example, a missing approver name) |
| 401 | `UNAUTHORIZED` | Client API key missing or invalid |
| 403 | `FORBIDDEN` | Action not allowed (approving a safety/legal incident, wrong approver, viewer key on owner-only endpoint) |
| 404 | `NOT_FOUND` | Unknown ID or path |
| 409 | `CONFLICT` | Incident is not in a state that allows this action |
| 422 | `VALIDATION_ERROR` | Body or query fails validation |
| 500 | `INTERNAL_ERROR` | Anything unexpected. Never leak stack traces. |

## 3. Environment and AI rules

- `MOCK_MODE` (default `true`): the whole demo runs with zero AI calls.
- `ANTHROPIC_API_KEY`: set only as a Render environment variable. Never in GitHub, any file, the frontend, or chat.
- `AI_MODEL`: default `claude-sonnet-5-5`.
- `FRONTEND_ORIGINS`: comma-separated allowed origins. CORS also allows `http://localhost:3000` and the regex `https://.*\.vercel\.app`.
- All AI calls live only in `backend/services/ai_client.py`, with a 30-second timeout. On timeout or error, return seeded data with `"source": "fallback"`.
- AI only **extracts** claims from answer text. Plain code decides every claim status, severity, and ranking.
- The database is rebuilt from seed data on every startup (Render free tier resets files).

## 4. Shared objects

**Product**
```json
{"productId": "prod_001", "brandId": "brand_001", "brandName": "Kestrel", "name": "Kestrel Aero 14",
 "price": 449.99, "currency": "USD", "availability": "in_stock",
 "specs": {"ramGb": 8, "storageGb": 256, "screenInches": 14, "batteryHours": 11, "weightLb": 2.9, "touchscreen": false},
 "returnPolicyDays": 30, "updatedAt": "2026-09-28T12:00:00Z",
 "factSource": "Brand product feed", "factSourceUrl": "https://www.kestrel.example/aero-14", "verifiedAt": "2026-09-28T12:00:00Z"}
```
`availability`: `in_stock` | `low_stock` | `out_of_stock`.
**v1.2 (Verified Data Layer):** `factSource` names where the verified facts come from (`Brand product feed` | `Brand website` |
`Manufacturer spec sheet`), `factSourceUrl` is the brand's own page for the product (fictional `.example` domain), and
`verifiedAt` is when CIRQO last verified the facts. `factSource` is deliberately not called `source`, because `source`
elsewhere in this contract means `live` | `mock` | `fallback` for AI output. `updatedAt` stays (when the brand last changed the record).
The database also stores `isClient` and `billingTier` on brands. **These are never returned by any
endpoint and never read by ranking code.**

**Claim**
```json
{"claimId": "clm_300", "answerId": "ans_120", "productId": "prod_001", "text": "The Kestrel Aero 14 costs $399.",
 "claimType": "price", "extractedValue": "399", "verifiedValue": "449.99",
 "status": "incorrect", "ruleId": "PRICE_MISMATCH", "factId": "fact_040",
 "reason": "Stated price is 11.3% below the verified price.", "checkedAt": "2026-09-29T17:05:00Z"}
```
`claimType`: `price` | `feature` | `availability` | `policy` | `comparison` | `safety_legal`.
`status`: `correct` | `incorrect` | `outdated` | `unverifiable`.
`productId`, `extractedValue`, `verifiedValue`, `factId` may be `null`. `ruleId` is `null` for a `correct` claim.

**Incident**
```json
{"incidentId": "inc_12", "claimId": "clm_300", "answerId": "ans_120", "productId": "prod_001",
 "ruleId": "PRICE_MISMATCH", "severity": "medium", "handling": "auto_fix", "status": "auto_fixed",
 "summary": "Assistant B understated the Kestrel Aero 14 price by 11.3%.",
 "aiSaid": "$399", "verifiedFact": "$449.99",
 "proposedFix": "Publish verified price $449.99 to the product feed and flag the source listing.",
 "ownerId": "own_01", "ownerName": "Maria Lopez", "falseAlarm": false,
 "createdAt": "2026-09-29T17:05:00Z", "resolvedAt": "2026-09-29T17:05:02Z", "resolvedBy": "system"}
```
`severity`: `low` | `medium` | `high` | `critical`.
`handling`: `auto_fix` | `human_approval` | `escalate`.
`status`: `auto_fixed` | `pending_approval` | `approved` | `rejected` | `escalated` | `resolved`.
`proposedFix` is `null` when `handling` is `escalate`. `resolvedAt` and `resolvedBy` are `null` while open.
An incident is **open** when `status` is `pending_approval` or `escalated` (equivalently, `resolvedAt` is `null`).

## 5. Checker rules (plain code, `backend/services/checker.py`)

Status is decided per claim against the verified product facts:

| ruleId | Status | Rule |
|--------|--------|------|
| (none) | `correct` | Value matches the verified fact. Price counts as matching within 1%. |
| `PRICE_MISMATCH` | `incorrect` | Price differs by more than 1% and does not match a previous price. |
| `PRICE_OUTDATED` | `outdated` | Price matches a previous price in the product's price history. |
| `SPEC_MISMATCH` | `incorrect` | The spec exists but the value differs. |
| `INVENTED_FEATURE` | `incorrect` | The claim asserts a spec or feature the product does not have. |
| `AVAILABILITY_MISMATCH` | `incorrect` | Stated availability differs from verified availability. |
| `POLICY_MISMATCH` | `incorrect` | Return policy or warranty terms differ from the verified policy. |
| `UNFAIR_COMPARISON` | `incorrect` | Names a competitor + comparative phrase with no verified comparison fact (keyword rules in `DECISIONS.md`). |
| `SAFETY_LEGAL` | `unverifiable` | Contains a safety/legal keyword (list in `DECISIONS.md`). Never auto-judged correct. |
| `NO_FACT` | `unverifiable` | No matching product or fact. Counted in metrics, **no incident created**. |

## 6. Severity and handling rules

| ruleId | Severity | Handling |
|--------|----------|----------|
| `PRICE_MISMATCH`, `PRICE_OUTDATED` | under 5% off: `low`; 5% to under 15%: `medium`; 15% or more: `high` | low/medium: `auto_fix`; high: `human_approval` |
| `AVAILABILITY_MISMATCH` | `medium` | `auto_fix` |
| `SPEC_MISMATCH` | `medium` | `auto_fix` |
| `INVENTED_FEATURE` | `high` | `human_approval` |
| `POLICY_MISMATCH` | `high` | `human_approval` |
| `UNFAIR_COMPARISON` | `high` | `human_approval` |
| `SAFETY_LEGAL` | `critical` | `escalate` (no fix is ever applied, only a human can close it) |

Every incident gets the owner whose `incidentTypes` include its `ruleId`. Every state change writes an audit entry.

## 7. Endpoints

### Health
**`GET /health`** → `{"status": "ok", "mockMode": true, "version": "0.1.0"}`

### Shopper funnel (legacy demo, kept for compatibility; the frontend no longer needs to show it)
**`GET /api/v1/shopper/questions`**
```json
{"openingQuery": "What are the best laptops under $500?",
 "questions": [
  {"questionId": "q_budget", "type": "single", "prompt": "What's your budget?",
   "options": [{"optionId": "b_400", "label": "Under $400"}, {"optionId": "b_500", "label": "Under $500"}, {"optionId": "b_700", "label": "Under $700"}]},
  {"questionId": "q_use", "type": "single", "prompt": "What will you use it for most?",
   "options": [{"optionId": "u_school", "label": "School"}, {"optionId": "u_work", "label": "Work"}, {"optionId": "u_travel", "label": "Travel"}, {"optionId": "u_media", "label": "Streaming and media"}]},
  {"questionId": "q_swipe", "type": "swipe", "prompt": "Swipe right on what matters to you.",
   "options": [{"optionId": "s_battery", "label": "All-day battery (10h+)"}, {"optionId": "s_light", "label": "Lightweight (under 3 lb)"},
               {"optionId": "s_screen", "label": "Big screen (15 in+)"}, {"optionId": "s_touch", "label": "Touchscreen"}]}]}
```

**`POST /api/v1/shopper/recommend`**
Request:
```json
{"answers": [{"questionId": "q_budget", "optionId": "b_500"}, {"questionId": "q_use", "optionId": "u_school"}],
 "swipes": [{"optionId": "s_battery", "liked": true}, {"optionId": "s_light", "liked": true},
            {"optionId": "s_screen", "liked": false}, {"optionId": "s_touch", "liked": false}]}
```
Response:
```json
{"recommendation": {"productId": "prod_001", "name": "Kestrel Aero 14", "brandName": "Kestrel", "price": 449.99, "currency": "USD",
   "availability": "in_stock", "matchScore": 0.92,
   "reasons": [{"text": "11-hour rated battery", "claimStatus": "correct", "factId": "fact_041"}],
   "verifiedAt": "2026-09-28T12:00:00Z"},
 "alternatives": [{"productId": "prod_007", "name": "Novex Slate 14", "brandName": "Novex", "price": 479.00, "matchScore": 0.85}],
 "rankingNote": "Ranking is neutral. No brand can pay for placement.",
 "source": "mock"}
```
Rules: ranking lives in `backend/services/ranking.py`: products over budget are excluded,
score = share of liked swipe features met + use-case fit, ties broken by lower price then `productId`.
Every reason passes through the checker; only reasons with status `correct` are returned.
If no product fits, `recommendation` is `null` and `alternatives` is empty. Errors: 422 for unknown `questionId` or `optionId`.

### Product detail (v1.7)
`GET /api/v1/products/{productId}` → the `/products` row plus `"comparisons": [{factId, otherProductId,
otherProductName, attribute, text}]` (the verified comparison facts). 404 for an unknown id. `GET /products` also
takes `?optedIn=true|false` (section 7d). The MCP tool `cirqo_details` calls this so an assistant asked for depth
quotes catalog facts instead of its memory.

### Remote MCP endpoint (v1.7)
`POST /mcp` (no `/api/v1` prefix) serves the two MCP tools `cirqo_search` and `cirqo_query` over Streamable HTTP,
stateless, JSON responses; clients send `Accept: application/json, text/event-stream`. It is the same code as
`backend/mcp_server.py` and calls the REST endpoints below over loopback. Test: `tools/list` returns both tools.

### Connector (what an AI assistant calls) - added in v1.1

CIRQO is sold to brands as a plugin for AI assistants. When a shopper asks an assistant a shopping question, the
assistant calls this endpoint instead of guessing. CIRQO answers from verified facts and records the interaction so
it appears in the brand's dashboard.

**`POST /api/v1/connector/query`**
Request:
```json
{"question": "What is the best laptop under $500 for school?", "assistantId": "ast_01",
 "constraints": {"maxPrice": 500, "useCase": "school", "mustHave": ["battery", "light"]}}
```
`assistantId` is required. `constraints` is optional; every field inside it is optional.
`useCase`: `school` | `work` | `travel` | `media`. `mustHave` values: `battery` | `light` | `screen` | `touch`
(same meanings as the shopper swipe options). If `constraints` is missing, the backend derives `maxPrice` from a
dollar amount in `question` when present.

Response:
```json
{"answerId": "ans_130", "question": "What is the best laptop under $500 for school?", "assistantId": "ast_01",
 "recommendation": {"productId": "prod_001", "name": "Kestrel Aero 14", "brandName": "Kestrel", "price": 449.99,
   "currency": "USD", "availability": "in_stock", "matchScore": 0.92, "returnPolicyDays": 30,
   "facts": [{"text": "11-hour rated battery", "claimStatus": "correct", "factId": "fact_041"}],
   "verifiedAt": "2026-09-28T12:00:00Z"},
 "alternatives": [{"productId": "prod_007", "name": "Novex Slate 14", "brandName": "Novex", "price": 479.00, "matchScore": 0.85}],
 "answerText": "Based on verified data, the Kestrel Aero 14 ($449.99, in stock) fits best: 11-hour rated battery, 2.9 lb. ...",
 "claims": [Claim],
 "rankingNote": "Neutral ranking. No brand can pay for placement.",
 "verifiedAt": "2026-09-29T20:10:00Z", "source": "mock"}
```
Rules:
- Ranking uses `services/ranking.py` exactly as the shopper endpoint does (neutral, tested).
- `answerText` is composed by plain code from verified facts (never by AI in mock mode). Every sentence in it is
  passed through the checker; `claims` lists the result, and every claim must be `correct`.
- The interaction is stored as an answer (`brandMentioned`, `rank`, `sourceIds` = `["src_brand"]` the brand's own
  verified feed) so it appears in `GET /api/v1/answers`, `GET /api/v1/visibility/summary` and the trust metrics.
- Writes an audit entry with `action: "connector_query"`, `actorType: "ai"`, `actor: <assistant name>`.
- If no product fits the constraints, `recommendation` is `null`, `alternatives` is empty, and `answerText`
  says so honestly. Still stored and audited.
- Errors: 422 for a missing `assistantId`, unknown `useCase` or `mustHave` value, or `maxPrice` <= 0. 404 for an unknown `assistantId`.

**`GET /api/v1/connector/manifest`**
Returns the contents of `backend/connector/manifest.json`: how an AI assistant would register CIRQO as a tool
(`name`, `description`, `version`, and the single `query` tool with its input schema). Static file, no auth.

### Products (verified facts)
**`GET /api/v1/products`** → `{"products": [Product]}` (all brands)

### Visibility
**`GET /api/v1/visibility/summary?days=30`** (days: 1 to 30, default 30)
```json
{"brandId": "brand_001", "brandName": "Kestrel", "periodDays": 30,
 "visibilityRate": 0.48, "averageRank": 2.7, "shareOfVoice": 0.31,
 "competitors": [{"brandName": "Arcton", "visibilityRate": 0.61, "averageRank": 2.1, "shareOfVoice": 0.38},
                 {"brandName": "Novex", "visibilityRate": 0.44, "averageRank": 3.0, "shareOfVoice": 0.31}],
 "byAssistant": [{"assistantId": "ast_01", "name": "Assistant A", "visibilityRate": 0.52, "averageRank": 2.4}]}
```
`visibilityRate` = share of tracked answers mentioning the brand. `averageRank` = mean position when mentioned (1 = first).
`shareOfVoice` = brand mentions / all brand mentions.

**`GET /api/v1/answers?assistantId=ast_01&limit=50`** (newest first)
```json
{"answers": [{"answerId": "ans_120", "queryText": "best laptops under $500", "assistantId": "ast_01", "assistantName": "Assistant A",
  "answerText": "...", "brandMentioned": true, "rank": 2 (null when brandMentioned is false), "sourceIds": ["src_01", "src_03"],
  "capturedAt": "2026-09-29T16:00:00Z", "source": "mock"}]}
```

### Sources
**`GET /api/v1/sources?days=30`**
```json
{"sources": [{"sourceId": "src_01", "name": "Example Tech Reviews", "domain": "reviews.example.com", "type": "review_site",
  "citationCount": 212, "citationShare": 0.34, "accuracyRate": 0.81, "lastSeenAt": "2026-09-29T16:00:00Z"}]}
```
`type`: `review_site` | `marketplace` | `brand_site` | `forum` | `news`. `accuracyRate` = share of correct claims in answers citing this source.

### Checker
**`POST /api/v1/checker/run`**
Request, one of: `{"answerId": "ans_120"}` or `{"answerText": "...", "assistantId": "ast_01", "queryText": "..."}`.
Response:
```json
{"answerId": "ans_121", "claims": [Claim], "incidentsCreated": ["inc_40"], "source": "mock"}
```
With `answerText`, a new answer is stored and gets a new `answerId`. In mock mode, claims are extracted with plain
regex and keyword rules. Errors: 404 unknown `answerId`, 422 if neither or both forms are sent.

**`GET /api/v1/claims?status=incorrect&answerId=ans_120&limit=50`** → `{"claims": [Claim]}` (both filters optional)

### Incidents and approval
**`GET /api/v1/incidents?status=pending_approval&severity=high&limit=50`** → `{"incidents": [Incident]}` (filters optional, newest first)

**`GET /api/v1/incidents/{incidentId}`** → `Incident`

**`POST /api/v1/incidents/{incidentId}/approve`**, body `{"approverName": "Maria Lopez", "note": "optional"}`
→ `Incident` with `status: "approved"`, `resolvedBy: approverName`, `resolvedAt` set. The fix is recorded as applied.

**`POST /api/v1/incidents/{incidentId}/reject`**, body `{"approverName": "Maria Lopez", "note": "required", "falseAlarm": true}`
→ `Incident` with `status: "rejected"`.

**`POST /api/v1/incidents/{incidentId}/resolve`**, body `{"resolverName": "Grace Kim", "note": "required"}`
→ `Incident` with `status: "resolved"`. Only for `escalated` incidents.

Rules for all three:
- 404 if the incident does not exist.
- 409 `CONFLICT` if approve/reject is used on anything not `pending_approval`, or resolve on anything not `escalated`.
- 403 `FORBIDDEN` if the name does not match the incident's `ownerName`, or if approve or reject is used on a `critical` incident (this check runs before the 409 check).
- 422 if a required field is missing or empty.

### Owners
**`GET /api/v1/owners`**
```json
{"owners": [{"ownerId": "own_01", "name": "Maria Lopez", "role": "Pricing Manager", "incidentTypes": ["PRICE_MISMATCH", "PRICE_OUTDATED"]}]}
```

### Audit log (append-only, no edit or delete endpoints)
**`GET /api/v1/audit?targetId=inc_12&limit=50`** (newest first, filter optional)
```json
{"entries": [{"auditId": "aud_501", "timestamp": "2026-09-29T17:05:02Z", "actor": "system", "actorType": "system",
  "action": "auto_fix_applied", "targetId": "inc_12", "details": "Published verified price $449.99."}]}
```
`actorType`: `system` | `human` | `ai`.
`action`: `claim_extracted` | `claim_checked` | `incident_created` | `auto_fix_applied` | `approved` | `rejected` | `escalated` | `resolved` | `connector_query` | `brand_onboarded` | `connector_search` | `login` | `brand_claimed` | `community_request` | `community_approved` | `community_rejected`.

### Trust metrics
**`GET /api/v1/metrics/trust?days=30`**
```json
{"periodDays": 30,
 "current": {"accuracyRate": 0.91, "hallucinationRate": 0.03, "medianTimeToResolveHours": 2.5, "falseAlarmRate": 0.06, "visibilityRate": 0.55},
 "daily": [{"date": "2026-08-31", "accuracyRate": 0.62, "hallucinationRate": 0.12, "claimsChecked": 88, "incidentsOpened": 21, "visibilityRate": 0.35}]}
```
Definitions:
- `accuracyRate` = correct claims / claims that are not `unverifiable`.
- `hallucinationRate` = `INVENTED_FEATURE` claims / all checked claims.
- `medianTimeToResolveHours` = median of `resolvedAt - createdAt` over closed incidents.
- `falseAlarmRate` = incidents rejected with `falseAlarm: true` / incidents closed by a human.
- `current` = values over the last 7 days. `daily` has exactly `days` entries, oldest first, ending today (UTC).

### Report
**`GET /api/v1/report?days=30`**
```json
{"generatedAt": "2026-09-29T18:00:00Z", "periodDays": 30, "brandName": "Kestrel",
 "impact": {"accuracyStart": 0.62, "accuracyEnd": 0.91, "hallucinationStart": 0.12, "hallucinationEnd": 0.03,
            "visibilityStart": 0.35, "visibilityEnd": 0.55},
 "incidents": {"total": 142, "autoFixed": 98, "humanApproved": 27, "rejected": 9, "escalated": 8, "open": 6,
               "medianTimeToResolveHours": 2.5},
 "topSources": [{"sourceId": "src_01", "name": "Example Tech Reviews", "citationShare": 0.34, "accuracyRate": 0.81}],
 "openHighRisk": ["inc_44", "inc_47"],
 "governance": {"automated": ["low and medium price, spec, and availability fixes"],
                "humanReviewed": ["large price errors", "invented features", "policy misstatements", "unfair comparisons"],
                "escalateOnly": ["safety and legal claims"],
                "owners": [{"name": "Maria Lopez", "role": "Pricing Manager"}]}}
```
`*Start` = first day of the period, `*End` = the `current` value from trust metrics.

## 7b. Brand accounts and onboarding (v1.3)

CIRQO serves many brands. Every brand-facing endpoint is scoped to one brand. **Backward compatible:** with no brand
given, everything behaves exactly as v1.2 (Kestrel, `brand_001`).

### Choosing the brand
- Dashboard endpoints accept an optional query parameter **`brandId`** (default `brand_001`):
  `/visibility/summary`, `/answers`, `/sources`, `/claims`, `/incidents`, `/owners`, `/audit`, `/metrics/trust`, `/report`.
  `visibilityRate`, `shareOfVoice`, `competitors`, incidents, owners, audit entries and trend are computed for that brand.
  `competitors` lists the other brands. 404 `NOT_FOUND` for an unknown `brandId`.
- `/incidents/{id}` and the approve/reject/resolve actions need no `brandId` (the incident already belongs to a brand).
- `POST /checker/run` is unchanged: incidents attach to the brand that owns the product mentioned.
- `POST /connector/query` is unchanged and deliberately brand-neutral: it ranks every brand's products.
- Client API (`/client/*`): the key decides the brand. Each brand has its own keys (below).

### Demo accounts
**`GET /api/v1/auth/demo-accounts`** (no auth; these are demo-only keys already in the repo)
```json
{"accounts": [
  {"brandId": "brand_001", "brandName": "Kestrel", "role": "owner",  "apiKey": "fd_demo_owner_2026"},
  {"brandId": "brand_001", "brandName": "Kestrel", "role": "viewer", "apiKey": "fd_demo_viewer_2026"},
  {"brandId": "brand_002", "brandName": "Arcton",  "role": "owner",  "apiKey": "fd_demo_arcton_2026"},
  {"brandId": "brand_003", "brandName": "Novex",   "role": "owner",  "apiKey": "fd_demo_novex_2026"}]}
```
Never returns `isClient` or `billingTier`.

### Onboarding: "Connect your catalog"
**`POST /api/v1/brands/onboard`**
Request:
```json
{"brandName": "Lumen Audio", "ownerName": "Sam Rivera",
 "products": [{"name": "Lumen Buds 2", "price": 129.00, "availability": "in_stock",
   "specs": {"batteryHours": 8, "weightLb": 0.1, "touchscreen": false},
   "returnPolicyDays": 30, "factSource": "Brand product feed", "factSourceUrl": "https://www.lumenaudio.example/buds-2"}]}
```
Response (201):
```json
{"brandId": "brand_004", "brandName": "Lumen Audio", "apiKey": "fd_lumen-audio_8f3a", "productsCreated": 1,
 "owners": [{"ownerId": "own_10", "name": "Sam Rivera", "role": "Brand Data Owner"}],
 "connectorReady": true, "note": "Demo data. Resets when the server restarts."}
```
Rules: 1 to 50 products; `name` and `price` required, other fields optional with the Product defaults; `specs` keys are
the Product spec keys (unknown keys are kept as-is). Creates the brand (`isClient: true`, `billingTier: "starter"`),
its products (`prod_` ids), an owner with role Brand Data Owner covering every `ruleId`, an audit entry
`action: "brand_onboarded"`, and an owner API key for `/client/*` and `brandId` use. The new brand is ranked by the
connector immediately and neutrally. Duplicate `brandName` (case-insensitive) → 409 `CONFLICT`. Validation → 422.
Onboarded data lives in SQLite until the next restart, by design.

### Seed (section 9 additions)
Arcton (`brand_002`) and Novex (`brand_003`) each get: 2 owners (Brand Data Owner, Trust and Safety Lead), at least
12 answers, at least 30 claims, at least 8 incidents covering `auto_fixed`, `pending_approval`, `approved`, `rejected`,
and their own 30-day daily metrics (accuracy improving, but different start and end values from Kestrel's).

### Tests
`test_brand_scope` (Arcton view shows Arcton's incidents only and lists Kestrel as a competitor; unknown brandId → 404;
default equals Kestrel), `test_onboard` (201 shape, new brand appears in `GET /products` and in a `connector/query`
result when it fits, duplicate → 409, 0 products → 422, audit entry written, `isClient` never in any response).

## 7c. Login, company profiles, catalog at scale, connector search (v1.4)

**Backward compatible.** Every v1.3 call keeps working unchanged. `brandId` query parameters still work; a login token is a
second way to choose the brand. All 354 existing tests must pass unchanged.

### Login (username and password)
Demo users are seeded (section 9). **`cirqo-demo` works for every demo user**, and the login page prints the demo usernames.
v1.7: each of the 150 sheet companies' admins **also** accepts the temporary password paired with their Login Email in the
sheet's "Login Credentials" tab; the 9 renamed companies accept their original sheet emails too. Only hashes of those
passwords are committed; the plaintext never enters the repository. Passwords are stored hashed (any standard hash). Tokens live in the database and die on restart, like everything else.

**`POST /api/v1/auth/login`** body `{"username": "maria.lopez@kestrel.example", "password": "cirqo-demo"}`
Response:
```json
{"token": "tok_9f3a...", "expiresAt": "2026-09-30T12:00:00Z",
 "user": {"userId": "usr_001", "name": "Maria Lopez", "role": "Brand Data Owner", "username": "maria.lopez@kestrel.example"},
 "brand": {"brandId": "brand_001", "brandName": "Kestrel"}}
```
Wrong username or password: 401 `UNAUTHORIZED` with message "Wrong username or password." (same message for both).
**`GET /api/v1/auth/me`** (header `Authorization: Bearer <token>`) → same shape without `token`. 401 if missing or expired.
**`POST /api/v1/auth/logout`** → `{"ok": true}`.

**Token scoping:** every dashboard endpoint in 7b accepts `Authorization: Bearer <token>`. When present, the brand is the
token's brand and `brandId` is ignored. When absent, v1.3 behaviour (query `brandId`, default Kestrel). Roles:
`Brand Data Owner`, `Trust and Safety Lead`, `Viewer` (viewer gets 403 `FORBIDDEN` on approve, reject, resolve),
`CIRQO Staff` (see below). `POST /incidents/{id}/approve|reject|resolve`: when a token is present, `approverName` /
`resolverName` may be omitted and defaults to the token user's name; the owner-match rule still applies.

### Company profile
**`GET /api/v1/brands/{brandId}`** (no auth, or token)
```json
{"brandId": "brand_001", "brandName": "Kestrel", "tagline": "Thin laptops for students and travelers",
 "categories": ["laptops"], "hqCity": "Austin, TX", "founded": 2016, "employees": 140,
 "ceo": {"name": "Priya Natarajan"}, "website": "https://www.kestrel.example",
 "admins": [{"userId": "usr_001", "name": "Maria Lopez", "role": "Brand Data Owner"}],
 "productCount": 40, "plan": "growth"}
```
`plan` is the brand's own subscription tier (`starter` | `growth` | `enterprise`) and is shown only on the brand's own
profile (403 for another brand's token). **Ranking code must never read it** (section 8 test still applies; `plan` is the
public name of the seed field `billingTier`). Never returns `isClient`.
**`GET /api/v1/brands`** (CIRQO Staff token only, else 403) → `{"brands": [{brandId, brandName, categories, productCount,
visibilityRate, openIncidents, escalatedIncidents, accuracyRate}]}` for every brand: the cross-company oversight view.

### Product category (v1.4.1: categories follow the source data)
Product gains `"category": "headphones" | "laptops" | "phones_tablets" | "computer_hardware"` and `"subcategory"` (the
sheet's Product Category, e.g. `Earbuds`, `Headset`, `Graphics Card`). `specs` holds the sheet's columns that are not `N/A`,
camelCased: `processor`, `graphics`, `displayType`, `resolution`, `ports`, `operatingSystem`, `batteryHours`, `weightG`,
plus `warranty`, `certifications` (list), `useCaseTags` (list), `otherNames` (list of short names the checker also matches).
Laptops keep the existing spec keys where they apply (`batteryHours`, `weightLb` derived from `weightG`, `screenInches`
parsed from `displayType` when present). `GET /api/v1/products?category=headphones&brandId=...` filters (both optional).
`POST /brands/onboard` products accept `category` (default `laptops`).

**Verified comparison facts:** the sheet's "Verified Comparisons" column ("Lighter than Nereus Drift Plus") is loaded as
comparison facts (`fact_` ids). The checker's `UNFAIR_COMPARISON` rule already says a comparison is `incorrect` only when
no verified comparison fact supports it; a claim matching one of these facts is `correct`.

### Connector search (the funnel)
**`POST /api/v1/connector/search`**
Request: `{"question": "I want headphones for the gym", "assistantId": "ast_01",
 "constraints": {"category": "headphones", "maxPrice": 150, "mustHave": ["wireless"]}}` (`constraints` optional; the
backend infers `category` and `maxPrice` from the question when missing).
Response:
```json
{"searchId": "srch_12", "category": "headphones", "optionCount": 5,
 "options": [{"productId": "prod_310", "name": "Lumen Buds 2", "brandName": "Lumen Audio", "price": 129.0,
   "availability": "in_stock", "matchScore": 0.88, "facts": [{"text": "8-hour battery", "claimStatus": "correct", "factId": "fact_9001"}]}],
 "narrowingHints": [{"attribute": "noiseCancelling", "question": "Do you want noise cancelling?", "splits": {"yes": 2, "no": 3}},
                    {"attribute": "weightOz", "question": "Does weight matter? Two are under 1 oz.", "splits": {"under1oz": 2, "over1oz": 3}}],
 "rankingNote": "Neutral ranking. No brand can pay for placement.", "verifiedAt": "...", "source": "mock"}
```
Rules: up to 5 options ordered by `matchScore` (same neutral ranking as `/connector/query`); every fact passes the checker;
`narrowingHints` name the attributes on which the options differ most (at most 3), phrased as a question an assistant can
ask; the search is recorded as an answer (`brandMentioned` per option's brand) and audited `connector_search`.
`/connector/query` is unchanged and remains the "one pick" call. Manifest (`GET /connector/manifest`) lists both tools and
describes the funnel: search first, ask the hints, then query for one pick.

### Seed at scale (section 9 additions, v1.4.1)
Source of truth for the catalog: **`backend/seed/source/greek_god_tech_companies.xlsx`** (committed; the backend engineer's
file). `generate.py` reads it (or a CSV export of its sheets) deterministically. **Database rebuild under 10 seconds** (test).
- **150 companies** across the 4 categories (sheet "Companies"): fictional Greek-god names, no real brands. Each gets a
  profile from the sheet (other names, warranty, certifications, use-case focus) plus generated: tagline, HQ, founded,
  employees, CEO, website on a `.example` domain, a `plan`, and **admins from the sheet's "Login Credentials"**
  (`username` = the sheet's Login Email, role Brand Admin maps to `Brand Data Owner`). **`cirqo-demo` works for every account; v1.7 also
  accepts each admin's sheet password (hashes only in the repo, see Login).** Kestrel, Arcton and Novex stay as they are (laptops) and keep
  all their data, so every existing test holds; that makes 153 brands.
- **1,500 products** from the sheet "Product Details" (`SKU` becomes the `prod_` id suffix), each with `category`,
  `subcategory`, specs, `priceHistory` (one earlier price generated), and Verified Data Layer fields.
- **Dashboard data:** every company gets an improving 30-day trend and at least 8 answers, 20 claims and 4 incidents
  covering `auto_fixed`, `pending_approval`, `approved`, `rejected`. If the 10-second rebuild test fails at 150, the 30
  companies with the lowest sheet ids plus Kestrel, Arcton and Novex keep full data (12+ answers, 30+ claims, 8+ incidents)
  and the rest keep the trend and 4 incidents. At least 5 companies have an `escalated` incident.
- **CIRQO Staff:** 2 users (`grace.kim@cirqo.example` Trust and Safety Lead, `dev.patel@cirqo.example` Product Owner),
  role `CIRQO Staff`, not tied to a brand. Grace Kim stays the owner of Kestrel's safety incidents.
- `GET /auth/demo-accounts` returns the three original brands' accounts plus the first 5 sheet companies, each with
  `username`, and the shared demo password note. `GET /brands` (staff) lists all 153.

### Tests
`test_auth` (login ok, wrong password 401 with the neutral message, `me`, logout, token scopes a dashboard call, viewer 403
on approve, staff `GET /brands` 200 and brand token 403, approve without `approverName` uses the token user),
`test_brand_profile`, `test_connector_search` (5 options max, hints name real differing attributes, all facts correct,
recorded and audited, category inferred from "headphones"), `test_seed_scale` (153 brands, 1,500 sheet products plus the originals, every
brand has at least one admin, a trend and incidents, rebuild under 10 s, no real brand names in company names), and the existing `test_ranking_neutral` extended to flip `plan`.

## 7d. Opted-in and not-opted-in brands (v1.5)

**Who the plugin is for:** the shopper. They enable CIRQO in their AI assistant to get more accurate, personalized
shopping answers. Brands benefit by opting in: their verified facts are what the assistant repeats, they get the
dashboard, and they see the interactions. The catalog therefore contains **both** kinds of brand. All are fictional.

- Brand gains **`optedIn: true | false`** (public; the same fact the seed calls `isClient`). Opted-in brands have admins,
  dashboards and verified facts. Not-opted-in brands have products only, from "public listings", and no dashboard until
  they claim their company.
- Product gains **`verified: true | false`** (true only for opted-in brands). For not-opted-in products `factSource` is
  `"Public listing (not verified by brand)"`, `verifiedAt` is `null`, and any claim about them is `unverifiable`
  (`NO_FACT`), never `correct`.
- **`/connector/search` and `/connector/query`** rank every brand's products on fit alone, opted in or not (section 8;
  the neutrality test now also flips `optedIn` and asserts the order is unchanged). Each option carries `verified` and
  its facts carry `claimStatus` `correct` (verified) or `unverifiable` (not verified). `answerText` labels them honestly:
  verified facts are stated; unverified ones are prefixed "Not verified by the brand:". Responses add
  `"verifiedCount"` and `"unverifiedCount"`.
- **Claim your company:** `POST /api/v1/brands/{brandId}/claim` body `{"ownerName": "...", "email": "..."}` turns a
  not-opted-in brand into an opted-in one: creates a Brand Data Owner (password `cirqo-demo`), an API key, marks every
  product `verified: true` with `factSource: "Brand product feed"` and `verifiedAt` now, starts an empty trend, and
  audits `brand_claimed`. 409 if already opted in. Response is the `/brands/onboard` shape plus `optedIn: true`.
- **Seed split:** of the 150 sheet companies, the 60 with the lowest sheet ids per category are opted in (Kestrel,
  Arcton, Novex too); the other 90 are not. `GET /brands` (staff) and `GET /brands/{id}` show `optedIn`. Login pages list
  only opted-in companies. `GET /products?optedIn=false` filters.
- **Privacy:** shopper preferences (budget, use, must-haves) live in the assistant conversation only. CIRQO stores the
  question, the constraints sent, and which products were returned. No shopper identity, ever.

## 7e. Community program (v1.6, stretch: after catalog, login and search)

Companies pledge surplus and refurbished units. **Community Partners** (schools, nonprofits, veterans groups, seeded as
fictional organizations) log in, browse one cross-company catalog of pledged units with the same verified facts as
everything else, and request units. Brands approve requests by a named owner. **CIRQO never verifies an individual's
income or need**; partners do that under their own rules. No personal data about recipients is ever stored.

- Product gains `condition: "new" | "refurbished" | "surplus"` (default `new`) and, when pledged,
  `communityPledge: {"unitsPledged": 40, "unitsPlaced": 12, "conditionNotes": "Grade A, new battery", "warrantyMonths": 12}`
  (otherwise `null`). Claims about condition are checked like any spec (`SPEC_MISMATCH`).
- **Seed:** about 8% of products are `refurbished` or `surplus`; opted-in brands pledge units on roughly a third of those
  (at least 150 pledged products overall). Three partner organizations: `Bexar Valley School District`,
  `Lone Star Veterans Network`, `Bridgeway Community Tech` (fictional), each with one login (role `Community Partner`,
  password `cirqo-demo`, usernames `<first>.<last>@<org-slug>.example`). Every brand with pledges has at least one placed
  request in its history so the impact tile is not empty.
- **`GET /api/v1/community/catalog?category=&brandId=&condition=&limit=`** (Community Partner or CIRQO Staff token)
  → `{"items": [{productId, name, brandId, brandName, category, condition, price, verified, communityPledge, facts:[...]}]}`
  across all brands, neutral order (by `unitsPledged - unitsPlaced` desc, then name). 403 for brand tokens and guests.
- **`POST /api/v1/community/requests`** (partner token) body `{"productId": "prod_310", "units": 10, "purpose": "Laptops for 10 students in the fall cohort"}`
  → 201 `{"requestId": "creq_12", "status": "pending_approval", "productId", "brandId", "partner": {"orgId", "orgName"}, "units", "purpose", "createdAt"}`.
  422 if units < 1 or above units available; 403 if the product is not pledged.
- **`GET /api/v1/community/requests?status=`** partner token: own requests; brand token: requests for its products; staff: all.
- **`POST /api/v1/community/requests/{requestId}/approve|reject`** (brand token, Brand Data Owner) body `{"note": "..."}`
  → the request with `status` `approved` (increments `unitsPlaced`) or `rejected`. 403 for other brands, 409 if not pending.
  Audit actions `community_request`, `community_approved`, `community_rejected`.
- **`GET /api/v1/community/impact?brandId=`** (brand token or `brandId`) → `{"unitsPledged", "unitsPlaced", "partnersServed", "requestsPending", "byCategory": [...]}`.
- **Connector:** `constraints.includeRefurbished: true` lets `/connector/search` and `/connector/query` return
  `refurbished` and `surplus` products (excluded by default); their `condition` and `communityPledge.warrantyMonths` are
  stated in `answerText` and checked like any fact.
- Login: partner usernames are listed on the login page under "Community partners". `GET /auth/me` returns
  `"org": {"orgId", "orgName"}` instead of `brand` for partner users.
- Tests: `test_community` (partner sees the catalog, brand token 403, request then approve increments `unitsPlaced`,
  reject leaves it, 409 on double approve, impact numbers add up, `includeRefurbished` gates the connector).

## 8. Neutral ranking (required test)

- `ranking.py` must never read `isClient`, `billingTier`, or any billing field. Products are passed to it as
  a Pydantic model that does not contain those fields.
- `backend/tests/test_ranking_neutral.py` must prove it: run the same shopper answers, flip `isClient` and
  `billingTier` for every brand, run again, and assert the ordered `productId` list is identical.

## 9. Seed data requirements (`backend/seed/`, deterministic, fixed random seed)

All names are fictional. Do not use real brands or real AI assistant names.

- **Brands:** `Kestrel` (the CIRQO client, `isClient: true`), competitors `Arcton` and `Novex`.
- **Products:** 12 laptops (6 Kestrel, 3 Arcton, 3 Novex), prices $329 to $699, at least 8 under $500.
  Each has a full spec set, `returnPolicyDays`, and at least one previous price in its price history.
- **Assistants:** `Assistant A`, `Assistant B`, `Assistant C` (labeled as simulated).
- **Sources:** 6, covering every source `type`.
- **Owners:** 3, together covering every `ruleId`:
  Maria Lopez, Pricing Manager (`PRICE_*`); Dev Patel, Product Content Lead (`SPEC_MISMATCH`, `INVENTED_FEATURE`,
  `AVAILABILITY_MISMATCH`); Grace Kim, Legal and Compliance (`POLICY_MISMATCH`, `UNFAIR_COMPARISON`, `SAFETY_LEGAL`).
- **Answers and claims:** at least 30 detailed answers with at least 90 claims, covering every `ruleId` at least once.
- **Incidents:** at least 20, covering every severity and status, including at least 3 `pending_approval`,
  at least 1 open `escalated`, and at least 2 rejected with `falseAlarm: true`.
- **Audit:** at least one entry for every seeded incident.
- **30-day trend (proof of impact):** daily metrics ending today. Accuracy rises from about 0.62 to about 0.91,
  hallucination falls from about 0.12 to about 0.03, visibility rises from about 0.35 to about 0.55.
  Small day-to-day noise is fine, but the 7-day averages must improve every week.
- **Shopper demo:** the default answers (`b_500`, `u_school`, battery and light liked) must return a clear winner
  on fit alone. At least one answer path must be won by a competitor (Arcton or Novex), to show ranking is neutral.

## 10. Mock files (`shared/mock/`)

One file per response, named after the endpoint. The frontend builds against these first.
`health.json`, `shopper_questions.json`, `shopper_recommend.json`, `products.json`, `visibility_summary.json`,
`answers.json`, `sources.json`, `checker_run.json`, `claims.json`, `incidents.json`, `incident_detail.json`,
`incident_approve.json`, `incident_reject.json`, `incident_resolve.json`, `owners.json`, `audit.json`,
`metrics_trust.json`, `report.json`, `error_not_found.json`, `error_validation.json`, `connector_query.json`, `connector_manifest.json` (v1.1).
Mock values must match the shapes above exactly.

## 11. Required tests (pytest)

`test_health`, `test_error_format` (404 and 422), `test_ranking_neutral`, `test_checker_rules` (one case per `ruleId`),
`test_severity_rules`, `test_approval_flow` (approve, reject, resolve, 403 and 409 cases), `test_trend_improves`,
`test_connector` (v1.1: a query returns only `correct` claims, is stored as an answer, writes an audit entry, 422 and 404 cases, and manifest loads).

## 12. Timeline (Central Time, compressed)

| Target (CT) | Deliverable |
|-------------|-------------|
| 2:30 PM 9/29 | Backend on Render with `/health`, CORS, `.env.example` |
| 3:30 PM 9/29 | Every file in `shared/mock/` (frontend switches to building real screens) |
| 6:30 PM 9/29 | Seed data loading, shopper funnel working in mock mode |
| 10:30 PM 9/29 | Checker, dashboard, governance endpoints working in mock mode (checker before recommend reasons) |
| 1:30 AM 9/30 | Report, client API subset, all tests passing |
| 2:30 AM 9/30 | Optional live AI behind `MOCK_MODE=false` (skip if behind) |
| 3:30 AM 9/30 | Code freeze, bug fixes only |
| 6:00 AM 9/30 | **Hard deadline** for the tech submission |
