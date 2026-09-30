# CIRQO in Claude Desktop (MCP server)

`backend/mcp_server.py` is a small [Model Context Protocol](https://modelcontextprotocol.io) server. It lets
Claude Desktop (or any MCP client) call CIRQO's Shopping Connector as tools. The server runs on your machine,
talks to Claude Desktop over stdin/stdout, and forwards each call to the CIRQO API:

```
Claude Desktop  --stdio-->  mcp_server.py  --HTTPS-->  POST {CIRQO_API_URL}/api/v1/connector/search
                                                       POST {CIRQO_API_URL}/api/v1/connector/query
```

It exposes three tools. Two form **the funnel**: search wide, narrow with the shopper's answers, then pick one. The
third, `cirqo_details`, gives depth on one product (full specs and verified comparisons) so "tell me more" is answered
from the catalog, never from memory. Every product carries a `verificationLabel`: **CIRQO Verified** (an opted-in
company, facts checked against its own data) or **Not CIRQO Verified** (a public listing of a brand that has not opted in).

| Tool | Endpoint | What it returns |
|---|---|---|
| **`cirqo_search`** | `POST /api/v1/connector/search` | Up to 5 options in neutral order, each marked `verified` (true when the brand opted in and its facts were checked, false when they come from a public listing) with its facts and their `claimStatus`, plus `narrowingHints`: the attributes on which those options differ most, each phrased as a question to ask the shopper. Also `verifiedCount`, `unverifiedCount`, and a `nextStep` line saying whether to ask a hint or go for the pick. |
| **`cirqo_query`** | `POST /api/v1/connector/query` | The one pick: an answer text in which unverified facts are prefixed "Not CIRQO Verified:", the recommendation and alternatives each marked `verified`, the checked claims behind it (each with the value stated, the verified value and its status, `correct` or `unverifiable`), `verifiedCount`, `unverifiedCount`, and the neutral-ranking note. |

`cirqo_details` takes one argument, `productId`, from any search or query result. The funnel tools take the same three:

| Argument | Required | Meaning |
|---|---|---|
| `question` | yes | What the shopper said, e.g. "I want headphones for the gym" |
| `assistantId` | yes | The calling assistant's ID registered with CIRQO, e.g. `ast_01` |
| `constraints` | no | `cirqo_search`: `category` (`laptops`, `headphones`, `phones_tablets`, `computer_hardware`), `maxPrice` (USD), `useCase`, `mustHave` (attribute tags; add one per answered hint). `cirqo_query`: `maxPrice`, `useCase` (`school`, `work`, `travel`, `media`), `mustHave` (any of `battery`, `light`, `screen`, `touch`). |

### The funnel, as the tool descriptions teach it

The descriptions and the server's instructions are written so an assistant runs this on its own, without being told:

1. **Start with `cirqo_search`** from whatever the shopper said, however vague. No clarifying questions before the first search.
2. **If `narrowingHints` come back**, ask the shopper **one** hint question at a time, in plain words. Never list every hint at once, and never ask about attributes the hints do not mention.
3. **Call `cirqo_search` again** with the answer added to `constraints`.
4. **When one or two options remain**, or no hints come back, **call `cirqo_query`** and present the single pick with its verified facts and the neutral-ranking note.
5. **Never invent a fact** that is not in the results. If CIRQO finds nothing, say so instead of guessing.
6. **Tell the shopper which facts are CIRQO Verified and which are not. Never present an unverified fact
   as verified.** Since v1.5 the catalog holds both brands that opted in (their products are `verified: true` and
   their facts were checked, `claimStatus: "correct"`) and brands that have not (products `verified: false`, facts
   from public listings, `claimStatus: "unverifiable"`). Both rank on fit alone.

**No AI key is involved.** Every fact and every sentence is checked by plain code on the CIRQO server before it is
returned, and ranking is neutral: no brand can pay for placement, and opting in does not move a brand up the list.
Claude only reads the results. Sample data uses fictional brands.

## 1. Install

From the repository root, with Python 3.11 or newer:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

That installs the official `mcp` package and `httpx`. Check the server starts (it waits for an MCP client on
stdin and exits when stdin closes, so this runs it for two seconds):

```bash
sleep 2 | .venv/bin/python backend/mcp_server.py; echo "exit code: $?"
```

Silence followed by `exit code: 0` is the good outcome.

## Option A (no install): add CIRQO as a custom connector

The same tools are served by the hosted backend as a remote MCP endpoint, for every assistant that speaks MCP:

```
https://frontdoor-api-hiel.onrender.com/mcp
```

**Claude** (web or desktop app, Pro or Max plan): **Settings, Connectors, Add custom connector**, name `CIRQO`,
paste the URL above, no authentication, **Add**.

**ChatGPT** (Plus, Pro, Team or Enterprise): **Settings, Connectors, Advanced, turn on Developer mode**, then
**Create**: name `CIRQO`, MCP server URL as above, authentication "No authentication", **Create**. In a chat, open
the tools menu, pick CIRQO, and ask normally. ChatGPT's framework calls the connector's `search` and `fetch` tools,
which wrap the same CIRQO endpoints; deep research mode uses them too.

**Gemini** (Gemini CLI or a Gemini-based agent): add the server to `~/.gemini/settings.json`:

```json
{"mcpServers": {"cirqo": {"httpUrl": "https://frontdoor-api-hiel.onrender.com/mcp"}}}
```

then `/mcp` inside the CLI lists `cirqo_search`, `cirqo_query`, `cirqo_details`, `search` and `fetch`. Two things
we hit on the night: Google sign-in for individual accounts is closed in Gemini CLI 0.62, so authenticate with a free
Gemini API key from https://aistudio.google.com/app/apikey (a personal Google account can create the project; a school
account may not) via `export GEMINI_API_KEY=...`; and free keys are refused by the "pro-preview" models, so run `/model`
and pick a Flash model before asking. The Gemini consumer app does not yet take custom connectors; when it does, the
same URL applies. Then in a new chat enable CIRQO under the tools menu and ask:
"I want headphones for the gym, budget around $150." Nothing to install, no config file, no restart. The free-tier
backend may take up to a minute to answer the first call while it wakes up.

The rest of this page is Option B: running the connector locally for Claude Desktop.

## 2. Register it in Claude Desktop

Open the Claude Desktop config file and add the `cirqo` entry. Create the file if it does not exist.

| OS | Config file |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Replace `/ABSOLUTE/PATH/TO/SuperFinalHSIGithub` with where you cloned the repository. Use the full path to the
virtualenv's `python` so Claude Desktop finds the installed packages.

```json
{
  "mcpServers": {
    "cirqo": {
      "command": "/ABSOLUTE/PATH/TO/SuperFinalHSIGithub/.venv/bin/python",
      "args": ["/ABSOLUTE/PATH/TO/SuperFinalHSIGithub/backend/mcp_server.py"],
      "env": {
        "CIRQO_API_URL": "https://frontdoor-api-hiel.onrender.com"
      }
    }
  }
}
```

`CIRQO_API_URL` is optional and defaults to `https://frontdoor-api-hiel.onrender.com`. To use a backend running
on your own machine, set it to `http://localhost:8000` instead.

Then fully quit (Cmd+Q on macOS) and reopen Claude Desktop. Both tools appear under the tools menu in a new chat.
The hosted API runs on a free tier and may take up to a minute to wake up on the first call.

## 3. Sample funnel conversation

**You:** I need headphones for the gym, I'm assistant ast_01.

**Claude:** *(calls `cirqo_search` with `question`: "headphones for the gym", `assistantId`: "ast_01")*

*(CIRQO returns five options, three from brands that opted in and two from brands that have not, plus two hints:)*

```json
{
  "searchId": "srch_12",
  "category": "headphones",
  "optionCount": 5,
  "options": [
    {"productId": "prod_310", "name": "Lumen Buds 2", "brandName": "Lumen Audio", "price": 129.0, "availability": "in_stock", "matchScore": 0.88, "verified": true,
     "facts": [{"text": "8-hour battery", "claimStatus": "correct", "factId": "fact_9001"},
               {"text": "Wireless, weighs 0.4 oz per bud", "claimStatus": "correct", "factId": "fact_9002"},
               {"text": "No noise cancelling", "claimStatus": "correct", "factId": "fact_9003"}]},
    {"productId": "prod_322", "name": "Tidewave Pulse", "brandName": "Tidewave", "price": 149.0, "availability": "in_stock", "matchScore": 0.84, "verified": true,
     "facts": [{"text": "10-hour battery", "claimStatus": "correct", "factId": "fact_9010"},
               {"text": "Active noise cancelling", "claimStatus": "correct", "factId": "fact_9012"}]},
    {"productId": "prod_341", "name": "Halcyon Buds Pro", "brandName": "Halcyon", "price": 148.0, "availability": "low_stock", "matchScore": 0.75, "verified": false,
     "facts": [{"text": "9-hour battery", "claimStatus": "unverifiable", "factId": "fact_9030"},
               {"text": "Active noise cancelling", "claimStatus": "unverifiable", "factId": "fact_9032"}]}
  ],
  "narrowingHints": [
    {"attribute": "noiseCancelling", "question": "Do you want noise cancelling?", "splits": {"yes": 2, "no": 3}},
    {"attribute": "weightOz", "question": "Does weight matter? Two are under 1 oz.", "splits": {"under1oz": 2, "over1oz": 3}}
  ],
  "nextStep": "Ask the shopper the first narrowingHints question in plain words, then call cirqo_search again with their answer added to constraints.",
  "verifiedCount": 9,
  "unverifiedCount": 6,
  "rankingNote": "Neutral ranking. No brand can pay for placement."
}
```

*(two more options omitted here for space)*

**Claude:** CIRQO found five pairs of gym headphones from $89 to $149. Three are from brands that verify their
product data with CIRQO; two, including the Halcyon Buds Pro, are listed from public sources and their specs are
not CIRQO Verified. Quick question to narrow it down: do you want noise cancelling, or would you rather
hear what's around you?

**You:** Noise cancelling, please.

**Claude:** *(calls `cirqo_search` with `question`: "headphones for the gym", `assistantId`: "ast_01",
`constraints`: `{"category": "headphones", "mustHave": ["noiseCancelling"]}`)*

*(CIRQO returns two options, the Tidewave Pulse (`verified: true`) and the Halcyon Buds Pro (`verified: false`),
and `nextStep` now says: "Narrow enough. Call cirqo_query with the same question and constraints for the single pick.")*

**Claude:** *(calls `cirqo_query` with `question`: "noise cancelling headphones for the gym", `assistantId`: "ast_01")*

*(CIRQO returns the one pick with its checked claims. The unverified alternative is labelled in the text and in the claims:)*

```json
{
  "answerText": "Based on verified data, the Tidewave Pulse ($149.00, in stock) fits best. The Tidewave Pulse is rated for 10 hours of battery life. The Tidewave Pulse has active noise cancelling. The Tidewave Pulse weighs 0.5 oz per bud. Not CIRQO Verified: the Halcyon Buds Pro lists active noise cancelling at $148.00.",
  "recommendation": {"productId": "prod_322", "name": "Tidewave Pulse", "brandName": "Tidewave", "price": 149.0, "availability": "in_stock", "verified": true},
  "alternatives": [{"productId": "prod_341", "name": "Halcyon Buds Pro", "brandName": "Halcyon", "price": 148.0, "availability": "low_stock", "verified": false}],
  "claims": [
    {"text": "The Tidewave Pulse is rated for 10 hours of battery life.", "claimType": "feature", "extractedValue": "10", "verifiedValue": "10", "status": "correct", "factId": "fact_9010"},
    {"text": "The Tidewave Pulse has active noise cancelling.", "claimType": "feature", "extractedValue": "true", "verifiedValue": "true", "status": "correct", "factId": "fact_9012"},
    {"text": "The Tidewave Pulse weighs 0.5 oz per bud.", "claimType": "feature", "extractedValue": "0.5", "verifiedValue": "0.5", "status": "correct", "factId": "fact_9011"},
    {"text": "Not CIRQO Verified: the Halcyon Buds Pro lists active noise cancelling at $148.00.", "claimType": "feature", "extractedValue": "true", "verifiedValue": null, "status": "unverifiable", "factId": null}
  ],
  "verifiedCount": 3,
  "unverifiedCount": 1,
  "rankingNote": "Neutral ranking. No brand can pay for placement."
}
```

**Claude:** CIRQO's pick is the **Tidewave Pulse** at $149.00, in stock. Tidewave verifies its data with CIRQO, so
these three facts were checked against the brand's own records: active noise cancelling, a 10-hour rated battery,
and 0.5 oz per bud. The alternative is the **Halcyon Buds Pro** at $148.00, low on stock. Halcyon has not opted in,
so its noise cancelling comes from a public listing and is **not CIRQO Verified**; treat that spec as
unconfirmed. Ranking is neutral: no brand paid for placement, and being verified did not move Tidewave up the list.

**You:** Anything under $80?

**Claude:** *(calls `cirqo_search` with `question`: "noise cancelling headphones for the gym under $80", `assistantId`: "ast_01")*

CIRQO found nothing under $80 with noise cancelling, and it does not guess when the data has no match. The cheapest
noise-cancelling pair it returned is the Halcyon Buds Pro at $148.00, and that one is not CIRQO Verified.
Want me to drop the noise-cancelling requirement instead? There are verified pairs from $89 without it.

Notice what Claude did not do: it did not ask three questions up front, it did not describe features that were not
in the results, it did not fill the gap under $80 with a guess, and it did not present the Halcyon spec as if a
brand had confirmed it. Each search and query is also recorded on the CIRQO dashboard as an answer with its checked
claims and an audit entry.

## Troubleshooting

- **The tools do not appear.** Check the config file is valid JSON, both paths are absolute, and that Claude
  Desktop was fully quit and reopened. Claude Desktop's own logs are in `~/Library/Logs/Claude` (macOS) or
  `%APPDATA%\Claude\logs` (Windows); `mcp-server-cirqo.log` shows the handshake or the error. On a Mac, make sure
  you opened the real desktop app (`/Applications/Claude.app`) and not a browser shortcut named Claude, which
  cannot run local servers.
- **"Could not reach CIRQO".** The API URL is wrong or the machine is offline. Try `CIRQO_API_URL` in a browser
  with `/api/v1/connector/manifest` appended.
- **"HTTP 404 (NOT_FOUND: Assistant ... does not exist.)"** Use an assistant ID that CIRQO knows, such as
  `ast_01`, `ast_02` or `ast_03` in the sample data.
- **Claude asks every hint at once, or invents a spec.** That is the assistant ignoring the tool descriptions.
  Remind it in chat: "Ask me one question at a time and only use facts CIRQO returned."
- **`verifiedCount` and `unverifiedCount` come back `null`.** The backend you are talking to predates contract
  v1.5. The server passes the counts through as sent and never computes them itself.

## Tests

```bash
cd backend && python -m pytest -q tests/test_mcp_server.py
```

The tests mock both HTTP calls with `httpx.MockTransport` (replies come from `shared/mock/connector_search.json`
and `shared/mock/connector_query.json`), so they need no network and no key. One test walks the whole funnel:
search, search again with the answered hint, then query. Another launches the real server as a subprocess and
completes the MCP handshake over stdio.

## What to expect in a chat

Ask the way a shopper would, no special wording: "i need new headphones", "laptop for college under $1100",
"tablet for reading". Claude calls `cirqo_search` first, shows the ranked list with a label on every product, asks at
most one narrowing question, then `cirqo_query` for the single pick; "tell me more about the second one" calls
`cirqo_details`. Results mix the opted-in stores (CIRQO Verified) with real brands that have not opted in
(Not CIRQO Verified), ranked on fit alone. For a clean demo, switch web search off in that chat so the assistant does
not add web results after the catalog list.
