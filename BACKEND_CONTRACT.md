# CIRQO Backend Contract

Status: **FINAL v1.3** (approved by lead engineer, 2026-09-29; v1.1 Connector, v1.2 Verified Data Layer fields, v1.3 brand accounts and onboarding, section 7b). Any change to a path,
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
`action`: `claim_extracted` | `claim_checked` | `incident_created` | `auto_fix_applied` | `approved` | `rejected` | `escalated` | `resolved` | `connector_query` | `brand_onboarded`.

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
