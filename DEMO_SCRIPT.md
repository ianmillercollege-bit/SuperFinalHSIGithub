# CIRQO demo script (about 4 minutes)

For judges and for the pitch presenter. Everything shown is fictional sample data and labeled as such.

**Before you start:** open https://frontdoor-api-hiel.onrender.com/health once. Optional: log in at `/login` as any demo admin (password `cirqo-demo`) to show a different company; the guest view is Kestrel. The free backend sleeps after
15 minutes idle and takes about a minute to wake. Then open https://utsa-tech-09302026.vercel.app.

## 1. Dashboard (30 seconds)
"Kestrel is a fictional laptop brand using CIRQO. Thirty days ago, AI assistants got 62% of the claims about its
products right. Today it's about 93%, and Kestrel shows up in 56% of relevant AI answers instead of 35%."
Point at the trend chart and the four trust numbers: claim accuracy, hallucination rate, median time to resolve, false alarm rate.
Optional: click **Download quarterly report** at the bottom; the file is the quarterly report every tier in the business plan includes.

## 2. Preview as shopper (60 seconds)
"This is what happens inside a shopper's AI assistant once a brand is on CIRQO. Shoppers never see CIRQO; their assistant calls it."
Keep the pre-filled question ("best laptop under $500 for school"), pick an assistant, choose a use case and one or two
must-haves, and submit.
"The assistant didn't guess. It called CIRQO's connector, got the brand's verified facts, and every sentence in this
answer was checked by code before it came back. Ranking is neutral: a test in the repo proves no brand can pay for placement."
Then click **AI Visibility** and show the new interaction at the top of the recorded answers. Scroll to **Sources the AI relied on**:
"This is the case's second question, what information the AI is using: which review sites, marketplaces and brand pages it cited, and how accurate each one was."

## 3. File a Claim (60 seconds)
"Now the other direction: what AI assistants are saying about the brand out in the wild."
Use the pre-filled example answer (wrong price, invented feature, correct spec) and submit.
"CIRQO pulled out three claims. The price is wrong by 11%, the fingerprint reader doesn't exist, the battery claim is
right. The AI only extracts; plain, testable code decides what's true."

## 4. Outstanding Claims (45 seconds)
"Wrong claims become incidents. Small ones are fixed automatically. These are the ones that need a person."
Open a pending item. Point at the owner's name and role, what the AI said versus the verified fact, and the proposed fix.
Approve it as the named owner.
"Safety and legal claims are different: nobody can approve a fix. They only escalate to the Trust and Safety Lead."

## 5. Claims Reviewed (30 seconds)
"Every decision, by the system or a person, is in the audit log."
Find the item you just approved at the top.

## 6. Scale, one line (10 seconds)
"153 companies, 1,500 products, a dashboard for each. Every company here is fictional." Click **All companies** if logged in as CIRQO Staff.

## 6b. The plugin in a real assistant (45 seconds)
In Claude (any device, CIRQO added as a custom connector, **web search switched off** in the chat), new chat:
"I need headphones for the gym around $150." Claude calls `cirqo_search`, shows five options
with **CIRQO Verified** or **Not CIRQO Verified** on each, and asks one narrowing question. Answer it;
Claude calls `cirqo_query` and gives one pick built only from checked facts. Then "tell me more about the first
one": Claude calls `cirqo_details` for specs and comparisons instead of guessing.
"This is what the shopper sees. They never open CIRQO. Their assistant does."

## 7. Close (15 seconds)
"Brands pay a quarterly subscription: Base $450 for up to 50 SKUs, Pro $1,200 for up to 250, Enterprise $3,000 for the
full catalog, with the first quarter's analytics free. Shoppers pay nothing. AI platforms pay nothing; they're partners,
because CIRQO makes their answers accurate. Brands pay for the service, never for placement."

## If something goes wrong
- "Backend offline": open the health link above, wait a minute, refresh.
- The approve button refuses: the approver name must exactly match the owner shown on the incident.
- Numbers reset overnight: the database rebuilds from seed data on every restart, by design, so the demo is repeatable.

## Two-minute spoken pitch (for the deck and the judges' Q&A)

**Problem (20 s).** "Shopping has moved into AI chat. People ask ChatGPT what to buy instead of opening ten tabs. The
answers sound confident and are often wrong: made-up specs, stale prices, products that do not exist. Small brands are
hurt twice: the AI rarely mentions them, and when it does, it gets them wrong."

**Product (15 s).** "CIRQO is a plug-in a shopper turns on inside their AI assistant, and a dashboard the brand gets
when it opts in. It is not preloaded in Claude or ChatGPT; the shopper adds it once, in about thirty seconds, and can turn it off any time. The assistant asks CIRQO instead of guessing. CIRQO answers from facts the brand verified, and every
product carries a badge: CIRQO Verified, or Not CIRQO Verified."

**Live demo, shopper side (45 s).** In ChatGPT or Claude with the connector on and web search off, type
"i need new headphones". Point at three things: "One: it called CIRQO on its own, no special words. Two: every product
has the badge. These five are Shopify stores that opted in; their facts were checked against their own data. This one is
JBL, a household name that has not opted in, so its facts are labelled not verified. Three: the ranking is on fit, not
fame. Nobody can pay to move up; a test in our code flips every brand's paid status and proves the order does not
change." Answer the one narrowing question, show the single pick. "Same address works in Claude, ChatGPT and Google's
Gemini tooling. One URL, three assistants, no app to download."

**Live demo, brand side (30 s).** Switch to the dashboard. "This is what the brand sees: how often AI recommends them,
what it said, and in Outstanding Claims every wrong price or policy statement waiting for a named human to approve the
fix. Our plan's governance rule, any price change gets human review, is enforced in the code, not just written in the
plan."

**Business (15 s).** "Brands pay a quarterly subscription: Base $450, Pro $1,200, Enterprise $3,000, first quarter
free. Shoppers pay nothing. Beachhead: 8,750 US consumer-electronics stores on Shopify with 25 or more products."

**Close (10 s).** "The new front door to commerce is an AI answer. CIRQO makes that answer trustworthy for the shopper
and visible for the brand. You can install it in your own ChatGPT in one minute. Here is the address:
https://frontdoor-api-hiel.onrender.com/mcp"

Presenter rules: web search off in the demo chat; open https://frontdoor-api-hiel.onrender.com/health five minutes
before to wake the backend; if the Gemini question comes up, the honest line is "live in Claude and ChatGPT where
shoppers chat today, working in Google's Gemini tooling now, ready for the Gemini app the day Google opens it."
