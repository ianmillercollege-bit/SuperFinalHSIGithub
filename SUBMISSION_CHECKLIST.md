# Tech submission checklist (lead), 9/30/2026

Deadline: **6:00 AM CT** (the instructions say 7:00 AM ET). Code freeze **3:30 AM CT**, reopened by the lead for website fixes until **4:30 AM CT**; nothing after that. Cut anything unmerged at **1:30 AM CT**.

## 3:30 AM: freeze
- [ ] Last merge to `main` done. CI green on `main` (Actions tab).
- [ ] Tell both engineers: bug fixes only, every fix on a branch, lead merges.
- [ ] Render shows "Deploy live" for the last `main` commit; Vercel shows "Ready".

## 4:00 AM: live checks (private window, as a judge)
- [ ] `./smoke_test.sh` against the live backend: all pass.
- [ ] Open https://frontdoor-api-hiel.onrender.com/health first (wakes the backend).
- [ ] https://utsa-tech-09302026.vercel.app opens on the sign-in page, and so does any dashboard URL opened in a new tab; after sign-in the splash plays once, then the dashboard; every sidebar page opens; "Sample data" badge on each.
- [ ] Log in as a demo admin (password `cirqo-demo`); company dashboard changes; "Continue as guest" shows the Guest chip (not Maria Lopez) and hides approve buttons.
- [ ] Preview as shopper returns a verified answer; the question appears in AI Visibility; the Sources panel lists sources.
- [ ] Dashboard: Download quarterly report saves `cirqo-report.json`.
- [ ] File a Claim on the example answer creates claims and incidents.
- [ ] Approve one Outstanding Claim as its owner; it appears in Claims Reviewed.
- [ ] Connect your catalog creates a brand; it appears in Preview as shopper.
- [ ] No Community links in the sidebar (cut at freeze); `/api/v1/community/impact?brandId=brand_001` still answers 200.
- [ ] Claude with the CIRQO custom connector (URL `https://frontdoor-api-hiel.onrender.com/mcp`, web search off): search, one question, pick, details; labels on every product (screenshots taken).

## 4:30 AM: repository
- [ ] Repo is **public**: https://github.com/ianmillercollege-bit/UTSA_TECH_09302026
- [ ] Name is exactly `UTSA_TECH_09302026`.
- [ ] `COVER_PAGE.md` present with school, team members, date, links.
- [ ] `README.md`: what it does, tech stack, how a judge navigates, how to run (`run.sh`), references, "all data simulated".
- [ ] `run.sh` and `smoke_test.sh` executable and current.
- [ ] `DEMO_SCRIPT.md` matches the final page names.
- [ ] No secrets: search the repo for `sk-ant` and `ANTHROPIC_API_KEY=` followed by a value. `.env` files not committed.
- [ ] `DECISIONS.md` open items (21, 22, 24) closed with the business team's final wording.
- [ ] Business plan and README agree on: product name spelling, pricing rule, sponsored slots, owner roles.

## 5:00 AM: package
- [ ] Zip of the repo named `UTSA_TECH_09302026.zip` as a backup upload (GitHub link is the primary).
- [x] Screenshots folder `docs/screenshots/` committed (Claude, ChatGPT and Gemini answering through the connector).
- [ ] Executive summary and pitch deck received from the business team; they cite the live links and the demo numbers.

## 5:15 AM: upload
- [ ] Upload at the competition portal. Only the latest upload counts; upload once, then verify.
- [ ] Open the uploaded link from a phone to confirm it is public and loads.

## During judging
- [ ] Wake the backend 5 minutes before: open `/health`.
- [ ] Keep `MOCK_MODE=true` on Render unless live AI was tested and approved.
- [ ] If the site says "Backend offline": open `/health`, wait 60 seconds, refresh.
