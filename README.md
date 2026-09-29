# FrontDoor: Trustworthy AI Product Discovery

**2026 HSI Battle of the Brains, Tech Submission.** Theme: "The New Front Door: Trustworthy AI Product Discovery."

- **Live app:** https://super-final-hsi-github.vercel.app
- **Live API (interactive docs):** https://frontdoor-api-hiel.onrender.com/docs
- **Repository:** https://github.com/ianmillercollege-bit/SuperFinalHSIGithub

> **All data in this demo is simulated.** Brands (Kestrel, Arcton, Novex), AI assistants (Assistant A, B, C),
> products, answers, and metrics are fictional sample data. Revenue figures are illustrative estimates with their
> assumptions shown on screen. Nothing here claims a real company or real AI assistant said anything.

> The backend runs on Render's free tier and sleeps after 15 minutes idle. If the app says "Backend: offline",
> open https://frontdoor-api-hiel.onrender.com/health, wait about a minute, then refresh.

## What it does

Shoppers now ask AI assistants "what are the best laptops under $500?" and may never visit a brand's website.
Brands lose visibility, and the AI can state wrong prices, features, availability, or policies.

FrontDoor is a trust and visibility platform for AI shopping. A company gives FrontDoor its verified product facts, and FrontDoor:

1. **Tracks visibility**: how often and how high the brand appears in AI answers, share of voice, and competitors.
2. **Shows sources**: which review sites, marketplaces, and brand pages the AI relied on, and how accurate each one is.
3. **Checks accuracy**: AI only *extracts* claims from answers. Plain, testable code decides whether each claim is
   correct, incorrect, outdated, or unverifiable against the verified facts.
4. **Governs fixes**: every wrong claim becomes an incident with a severity.
   - Low and medium risk (small price, spec, or stock errors): fixed automatically.
   - High risk (large price errors, invented features, policy misstatements, unfair comparisons): waits for a named human owner to approve or reject.
   - Safety and legal claims: escalated only. No automatic fix, ever.
5. **Keeps an audit log** of every action by the system, the AI, and people. Every incident type has a named owner.
6. **Measures trust over time**: accuracy rate, hallucination rate, time to resolve, and false alarm rate.
   The 30-day sample trend shows accuracy rising from 62% to about 91%.
7. **Shopper demo**: a broad question narrows to one verified recommendation (with a swipe-style question),
   showing what a verified AI answer looks like. Every reason shown has passed the checker.

**Neutral ranking:** brands can never pay for placement. The ranking code never receives the client or billing
fields, and `backend/tests/test_ranking_neutral.py` proves the results are identical when those fields change.

## How a judge should navigate it

Open https://super-final-hsi-github.vercel.app and use the top menu:

| Page | What to look at |
|------|-----------------|
| **Shopper demo** | Start from "What are the best laptops under $500?", answer the questions, swipe on features, and get one verified recommendation with checked reasons. |
| **Trust dashboard** | Visibility score, share of voice vs. competitors, sources the AI relied on, and the 30-day accuracy trend (our proof of impact). |
| **Incidents** | Every wrong AI claim, its severity, what the AI said vs. the verified fact, and whether it was auto-fixed, awaiting approval, or escalated. |
| **Approvals** | High-risk fixes waiting for their named owner. Try approving or rejecting one (the approver name must match the owner). |
| **Audit log** | Who did what and when: system, AI, or a named person. |
| **Growth (extra)** | Illustrative revenue simulator and a demo coach with pre-written answers. Clearly labeled as estimates and sample data. |

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
frontend/           Next.js app (app/ pages, components/, lib/)
shared/mock/        One example JSON response per endpoint (the frontend built against these first)
BACKEND_CONTRACT.md      API contract: every endpoint, field, error, severity rule, and seed data rule
CLIENT_API_CONTRACT.md   Read-only API for customer companies
DECISIONS.md        Team decisions log
run.sh, smoke_test.sh
```

## Ethics and governance summary

- **Accuracy decided by code, not AI.** The AI extracts claims; deterministic rules judge them (`backend/services/checker.py`).
- **Human in the loop for high risk.** Named owners approve or reject; safety and legal claims are escalate-only.
- **Accountability.** Every incident type has a named owner, and every action is in the append-only audit log.
- **Neutral ranking**, proven by a test.
- **Honest labeling.** All sample data and estimates are labeled as such, in the app and in this README.

## Team

Three-person engineering team (lead, backend, frontend) plus a three-person business team.
All code in this repository was written for this competition.
