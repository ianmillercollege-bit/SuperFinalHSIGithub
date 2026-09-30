# CIRQO by CIRQO AI: Trustworthy AI Product Discovery

[![CI](https://github.com/ianmillercollege-bit/UTSA_TECH_09302026/actions/workflows/ci.yml/badge.svg)](https://github.com/ianmillercollege-bit/UTSA_TECH_09302026/actions/workflows/ci.yml)

**UTSA_TECH_09302026: 2026 HSI Battle of the Brains, Tech Submission (UTSA).** Theme: "The New Front Door: Trustworthy AI Product Discovery."
Cover page: [`COVER_PAGE.md`](COVER_PAGE.md). Companion document: the CIRQO 5-Page Business and Marketing Plan (`UTSA_5PBP_09292026.pdf`).

- **Live app:** https://utsa-tech-09302026.vercel.app
- **Live API (interactive docs):** https://frontdoor-api-hiel.onrender.com/docs
- **Repository:** https://github.com/ianmillercollege-bit/UTSA_TECH_09302026

> **All data in this demo is simulated.** Brands (Kestrel, Arcton, Novex), AI assistants (Assistant A, B, C),
> products, answers, and metrics are fictional sample data. Revenue figures are illustrative estimates with their
> assumptions shown on screen. Nothing here claims a real company or real AI assistant said anything.

> The backend runs on Render's free tier and sleeps after 15 minutes idle. If the app says "Backend: offline",
> open https://frontdoor-api-hiel.onrender.com/health, wait about a minute, then refresh.

## What it does

Shoppers now ask AI assistants "what are the best laptops under $500?" and may never visit a brand's website.
Brands lose visibility, and the AI can state wrong prices, features, availability, or policies.

CIRQO is an **API plugin for AI assistants plus a brand dashboard**, for consumer technology brands. It is not a
shopping app. A brand connects its product catalog to CIRQO. When a shopper asks an AI assistant a shopping question,
the assistant calls CIRQO instead of guessing and gets verified facts back. CIRQO records what was asked and answered,
checks every claim, and shows the brand the results. Shoppers never see CIRQO: they only talk to their AI assistant,
and CIRQO works behind it. The dashboard is for brands; the Preview as shopper page stands in for the assistant so a
judge can watch the exchange. The three components from the business plan:

| Component (business plan) | Who it serves | Where it is in this repo |
|---------------------------|---------------|--------------------------|
| **Shopping Connector** | Consumers, inside their AI assistant | `POST /api/v1/connector/search` (the funnel: up to 5 options plus narrowing questions) and `POST /api/v1/connector/query` (one verified pick). `GET /api/v1/connector/manifest` describes both tools. The **Preview as shopper** page shows what the assistant receives. To enable it in Claude Desktop as an MCP plugin, see `backend/connector/README.md`. |
| **Visibility and Accuracy Dashboard** | Technology brands | The dashboard site: AI inclusion, rankings, competitors, sources used, incorrect product information, claims to review, and the audit trail. |
| **Verified Data Layer** | Both | The verified product facts (`GET /api/v1/products`) with timestamps, which every AI claim is checked against. |

A brand connects its verified product facts, and CIRQO:

1. **Tracks visibility**: how often and how high the brand appears in AI answers, share of voice, and competitors.
2. **Shows sources**: which review sites, marketplaces, and brand pages the AI relied on, and how accurate each one is.
3. **Checks accuracy**: AI only *extracts* claims from answers. Plain, testable code decides whether each claim is
   correct, incorrect, outdated, or unverifiable against the verified facts.
4. **Governs fixes**: every wrong claim becomes an incident with a severity.
   - Low and medium risk spec or stock errors: fixed automatically.
   - Anything about price, promotions, return or warranty policy, invented features or unfair comparisons: waits for a named human owner to approve or reject, as the business plan's governance table requires.
   - Safety and legal claims: escalated only. No automatic fix, ever.
5. **Keeps an audit log** of every action by the system, the AI, and people. Every incident type has a named owner.
6. **Measures trust over time**, using the success metrics from the business plan: AI-answer inclusion rate
   (visibility), claim accuracy rate, hallucination rate, median time to resolve, and false alarm rate.
   The 30-day sample trend shows claim accuracy rising from 62% to about 93% and AI-answer inclusion from 35% to 56%.
   `GET /api/v1/report` is the aggregated summary of errors and resolutions that the plan commits to publishing each quarter.
7. **Answers the assistant from verified facts**: the connector composes its answer from checked facts only, with
   neutral ranking, and every sentence passes through the checker before it leaves CIRQO.

**Plans (business plan 4.1):** the dashboard's `plan` field maps to the plan's tiers: `starter` = Base ($450 per
quarter, up to 50 SKUs, weekly updates), `growth` = Pro ($1,200, up to 250 SKUs, error alerts), `enterprise` =
Enterprise ($3,000, full catalog, real-time data). The first quarter of analytics is free. Brands pay for the service,
never for placement.

**Neutral ranking:** brands can never pay for placement. The ranking code never receives the client or billing
fields, and `backend/tests/test_ranking_neutral.py` proves the results are identical when those fields change.

## Get CIRQO: two ways in

**Shoppers (30 seconds, nothing to install).** In Claude (web, desktop or phone): Settings, Connectors,
Add custom connector, name `CIRQO`, URL `https://frontdoor-api-hiel.onrender.com/mcp`, no authentication.
Start a chat and ask the way you normally would: "I need headphones for the gym around $150." (For a clean demo, switch web search off in that chat so the assistant does not add web results after the catalog list.)
The assistant searches the verified catalog, asks one narrowing question, and picks. Every product it names is
labelled **CIRQO Verified** or **Not CIRQO Verified**. The same URL was added to ChatGPT (Plus, Developer
mode connector, which uses the server's `search` and `fetch` tools) and answered a shopping question there on the
night of the submission; it also works in Gemini CLI; `backend/connector/README.md` has
the three sets of steps and a local install for Claude Desktop.

**Brands (2 minutes).** Open https://utsa-tech-09302026.vercel.app, click **Connect your catalog**, enter the
company name, the owner's name and a few products. The company gets a dashboard, an API key and verified facts
in every assistant answer from that moment. A company already listed from public data claims its listing instead
(`POST /api/v1/brands/{brandId}/claim`), which flips its products from "Not CIRQO Verified" to verified.
Launch segment: small Shopify stores; the dashboard's storefront revenue panel is where their sales appear.

**Community partners.** Schools, nonprofits and veterans groups sign in (demo:
`rosa.delgado@bexar-valley-school-district.example`, password `cirqo-demo`) and request pledged surplus and
refurbished units from every brand at once.

## How a judge should navigate it

Open https://utsa-tech-09302026.vercel.app. It opens on the Kestrel dashboard as a guest; no login needed.
A click-by-click script with talking points is in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md).

**Logging in (optional):** the login page lists demo usernames. Every demo password is `cirqo-demo`. Each admin lands on
their own company's dashboard. There is also a "Continue as guest" link, so nobody can be locked out. Sign-in is real
(hashed passwords, server-side tokens), but every account is fictional and reset on restart.

| Sidebar item | What to look at |
|--------------|-----------------|
| **Dashboard** | The company's trust numbers and the 30-day trend: claim accuracy rising, hallucination rate falling, AI-answer inclusion rising. The chart moves during a demo: every claim you check counts toward today. |
| **AI Visibility** | How often the company appears in AI answers, average rank, share of voice, per assistant, and the recorded answers behind the numbers. |
| **Market Position** | The company against its competitors on the same measures. |
| **Company** and **Products** | Profile (CEO, admins, plan), and the verified catalog with its sources and timestamps: the Verified Data Layer. |
| **Preview as shopper** | See what a shopper's AI assistant answers when it uses the verified catalog. Type a question as if you were in ChatGPT or Claude; every fact comes back checked. Shoppers never see CIRQO; their assistant calls it. |
| **Connect your catalog** | Onboard a new company with a small product file. It is ranked by the connector immediately, and neutrally. |
| **File a Claim** | Paste any AI answer about the company. CIRQO extracts each claim and marks it correct, incorrect, outdated or unverifiable against verified facts, and opens incidents for the wrong ones. |
| **Outstanding Claims** | Wrong claims waiting for a named person: high-risk fixes to approve or reject, and safety or legal claims that only a person can close. Try approving one as its owner. |
| **Claims Reviewed** | Everything already decided, by the system or by a person, with the full audit trail. |
| **Community catalog** and **Community requests** (Community Partner login, for example `rosa.delgado@bexar-valley-school-district.example`) | The Community program: brands pledge surplus and refurbished units; schools, nonprofits and veterans groups browse one cross-company catalog and request units. The brand's owner approves or rejects. CIRQO never verifies anyone's income and stores no recipient data. |
| **All companies** (CIRQO Staff login) | Cross-company oversight: inclusion, open incidents and escalations for every company. |

**Scale:** 153 fictional opted-in companies (Greek-god names) across headphones, laptops, phones and tablets, and
computer hardware; 1,500 verified products with real spec sheets; 2,946 verified comparison facts; a dashboard for every
opted-in company; plus 12 real brands and 70 products listed as not verified.
The whole database rebuilds from seed in under a second on every restart.

**Opted in or not:** the catalog holds two kinds of company. The 153 fictional Shopify stores have all opted in: verified
facts, a dashboard, a login, and every fact they publish is checked and marked **CIRQO Verified**. Alongside them sit
12 real brands that have not opted in (Apple, Samsung, Sony, Bose, Dell, HP, Lenovo, Microsoft, Google, JBL, Logitech,
Corsair) with 70 well-known products listed from public data: approximate facts, every one marked **Not CIRQO
Verified**, in the dashboard and in the assistant's answer, and no dashboard of their own. The assistant ranks both kinds on
fit alone; nothing about a brand's status ever reaches the ranking code. That is the pitch in one search result: the
opted-in store's facts carry the badge, the household name's do not.

**For shoppers (the plugin):** `backend/connector/README.md` explains how to enable CIRQO in Claude Desktop as an MCP
plugin. The assistant then runs the shopping funnel itself: `cirqo_search` from whatever the shopper said, one
narrowing question at a time, then `cirqo_query` for one pick, saying which facts the brand verified. Try:
"I want headphones for the gym, budget around $150." The same connector shape works for any assistant that supports
tools.

To explore the API directly, open https://frontdoor-api-hiel.onrender.com/docs and click any endpoint, then "Try it out".
The read-only client API needs the header `X-API-Key: fd_demo_owner_2026` (demo key, sample data only).

## Tech stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | Next.js (React, TypeScript) | Vercel |
| Backend | Python 3.11, FastAPI, Uvicorn, Pydantic v2 | Render |
| Database | SQLite via SQLAlchemy, rebuilt from seed data on every startup | Render |
| Tests | pytest | local |
| AI (optional) | Anthropic API, isolated in `backend/services/ai_client.py`, 30-second timeout, falls back to seeded data | off by default (`MOCK_MODE=true`) |

The demo runs with **zero AI calls** by default. The AI key is stored only as a Render environment variable,
never in this repository or the frontend.

## How to run it locally

Requirements: Python 3.11+, Node.js 20+, and bash (macOS, Linux, or Git Bash / WSL on Windows).

```bash
./run.sh          # installs everything, starts the backend on :8000 and the frontend on :3000
./run.sh test     # runs the backend test suite
./smoke_test.sh   # checks the live API (or pass a URL: ./smoke_test.sh http://localhost:8000)
```

Then open http://localhost:3000. Press Ctrl+C to stop both servers.

Manual steps, if you prefer:

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (second terminal)
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## Repository layout

```
backend/            FastAPI app (routers/, services/checker.py, services/ranking.py, services/ai_client.py, tests/)
frontend/           Next.js app (app/ pages, components/, lib/); frontend/INTEGRATION.md maps each page to its endpoint
shared/mock/        One example JSON response per endpoint (the frontend built against these first)
BACKEND_CONTRACT.md      API contract: every endpoint, field, error, severity rule, and seed data rule
CLIENT_API_CONTRACT.md   Read-only API for customer companies
DECISIONS.md        Team decisions log
run.sh, smoke_test.sh, DEMO_SCRIPT.md, COVER_PAGE.md
.github/workflows/ci.yml   Runs backend tests and the frontend build on every push
```

## Ethics and governance summary

- **Accuracy decided by code, not AI.** The AI extracts claims; deterministic rules judge them (`backend/services/checker.py`).
- **Human in the loop for high risk.** Named owners approve or reject; safety and legal claims are escalate-only.
  An incident waiting for a person is the plan's "verification pending" state.
- **Accountability.** Every incident type has a named owner, and every action is in the append-only audit log.
- **Regression set.** Every resolved incident stays in the seeded history, so the checker rules are re-tested against
  past errors on every run (`backend/tests/`).
- **Neutral ranking**, proven by a test.
- **Honest labeling.** All sample data and estimates are labeled as such, in the app and in this README.

## Team

UTSA: Ian Miller, Zain Imam, Eniyan Aravindan, Aditya Ballal, Matthew Hernandez, Abraham Ly.
Three members built the tech solution (lead, backend, frontend) and three wrote the business plan.
All code in this repository was written by the team for this competition.

## References

Business context (cited in full in the business plan):

- Gartner. (2026, May 27). *Gartner survey finds consumers want AI shopping help but not AI purchase decisions.* Gartner Newsroom.
- SOCi. (2026). *The challenge of AI visibility for brands, part 1.* SOCi Blog.
- Store Leads. (2026). *Shopify stores in the Consumer Electronics category (United States).* storeleads.app.

Open-source software used (no code copied; used as dependencies):

- FastAPI, Uvicorn, Pydantic, SQLAlchemy, pytest, httpx (Python backend)
- Next.js, React, TypeScript (frontend)
- Hosting: Render (backend), Vercel (frontend)
