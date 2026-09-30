# CIRQO in Claude Desktop (MCP server)

`backend/mcp_server.py` is a small [Model Context Protocol](https://modelcontextprotocol.io) server. It lets
Claude Desktop (or any MCP client) call CIRQO's Shopping Connector as tools. The server runs on your machine,
talks to Claude Desktop over stdin/stdout, and forwards each call to the CIRQO API:

```
Claude Desktop  --stdio-->  mcp_server.py  --HTTPS-->  POST {CIRQO_API_URL}/api/v1/connector/search
                                                       POST {CIRQO_API_URL}/api/v1/connector/query
```

It exposes two tools that together form **the funnel**: search wide, narrow with the shopper's answers, then pick one.

| Tool | Endpoint | What it returns |
|---|---|---|
| **`cirqo_search`** | `POST /api/v1/connector/search` | Up to 5 verified options in neutral order, each with checked facts, plus `narrowingHints`: the attributes on which those options differ most, each phrased as a question to ask the shopper. Also a `nextStep` line saying whether to ask a hint or go for the pick. |
| **`cirqo_query`** | `POST /api/v1/connector/query` | The one pick: an answer text built only from verified facts, the recommendation with alternatives, the checked claims behind it (each with the value stated, the verified value and its status), and the neutral-ranking note. Unchanged from v1. |

Both take the same three arguments:

| Argument | Required | Meaning |
|---|---|---|
| `question` | yes | What the shopper said, e.g. "I want headphones for the gym" |
| `assistantId` | yes | The calling assistant's ID registered with CIRQO, e.g. `ast_01` |
| `constraints` | no | `cirqo_search`: `category` (`laptops`, `headphones`, `smart_home`, `monitors`, `accessories`), `maxPrice` (USD), `useCase`, `mustHave` (attribute tags; add one per answered hint). `cirqo_query`: `maxPrice`, `useCase` (`school`, `work`, `travel`, `media`), `mustHave` (any of `battery`, `light`, `screen`, `touch`). |

### The funnel, as the tool descriptions teach it

The descriptions and the server's instructions are written so an assistant runs this on its own, without being told:

1. **Start with `cirqo_search`** from whatever the shopper said, however vague. No clarifying questions before the first search.
2. **If `narrowingHints` come back**, ask the shopper **one** hint question at a time, in plain words. Never list every hint at once, and never ask about attributes the hints do not mention.
3. **Call `cirqo_search` again** with the answer added to `constraints`.
4. **When one or two options remain**, or no hints come back, **call `cirqo_query`** and present the single pick with its verified facts and the neutral-ranking note.
5. **Never invent a fact** that is not in the results. If CIRQO finds nothing, say so instead of guessing.

**No AI key is involved.** Every fact and every sentence is checked by plain code on the CIRQO server before it is
returned, and ranking is neutral: no brand can pay for placement. Claude only reads the results. Sample data uses
fictional brands.

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

*(CIRQO returns five options and two hints:)*

```json
{
  "searchId": "srch_12",
  "category": "headphones",
  "optionCount": 5,
  "options": [
    {"productId": "prod_310", "name": "Lumen Buds 2", "brandName": "Lumen Audio", "price": 129.0, "availability": "in_stock", "matchScore": 0.88,
     "facts": [{"text": "8-hour battery", "claimStatus": "correct", "factId": "fact_9001"},
               {"text": "Wireless, weighs 0.4 oz per bud", "claimStatus": "correct", "factId": "fact_9002"},
               {"text": "No noise cancelling", "claimStatus": "correct", "factId": "fact_9003"}]},
    {"productId": "prod_322", "name": "Tidewave Pulse", "brandName": "Tidewave", "price": 149.0, "availability": "in_stock", "matchScore": 0.84,
     "facts": [{"text": "10-hour battery", "claimStatus": "correct", "factId": "fact_9010"},
               {"text": "Active noise cancelling", "claimStatus": "correct", "factId": "fact_9012"}]}
  ],
  "narrowingHints": [
    {"attribute": "noiseCancelling", "question": "Do you want noise cancelling?", "splits": {"yes": 2, "no": 3}},
    {"attribute": "weightOz", "question": "Does weight matter? Two are under 1 oz.", "splits": {"under1oz": 2, "over1oz": 3}}
  ],
  "nextStep": "Ask the shopper the first narrowingHints question in plain words, then call cirqo_search again with their answer added to constraints.",
  "rankingNote": "Neutral ranking. No brand can pay for placement."
}
```

*(three more options omitted here for space)*

**Claude:** CIRQO found five verified pairs of gym headphones, from $89 to $149. Quick question to narrow it down:
do you want noise cancelling, or would you rather hear what's around you?

**You:** Noise cancelling, please.

**Claude:** *(calls `cirqo_search` with `question`: "headphones for the gym", `assistantId`: "ast_01",
`constraints`: `{"category": "headphones", "mustHave": ["noiseCancelling"]}`)*

*(CIRQO returns two options, the Tidewave Pulse and the Lumen Buds Pro, and `nextStep` now says:
"Narrow enough. Call cirqo_query with the same question and constraints for the single pick.")*

**Claude:** *(calls `cirqo_query` with `question`: "noise cancelling headphones for the gym", `assistantId`: "ast_01")*

*(CIRQO returns the one pick with its checked claims:)*

```json
{
  "answerText": "Based on verified data, the Tidewave Pulse ($149.00, in stock) fits best. The Tidewave Pulse is rated for 10 hours of battery life. The Tidewave Pulse has active noise cancelling. The Tidewave Pulse weighs 0.5 oz per bud. Another verified option is the Lumen Buds Pro at $148.00.",
  "recommendation": {"productId": "prod_322", "name": "Tidewave Pulse", "brandName": "Tidewave", "price": 149.0, "availability": "in_stock"},
  "alternatives": [{"productId": "prod_341", "name": "Lumen Buds Pro", "brandName": "Lumen Audio", "price": 148.0}],
  "claims": [
    {"text": "The Tidewave Pulse is rated for 10 hours of battery life.", "claimType": "feature", "extractedValue": "10", "verifiedValue": "10", "status": "correct", "factId": "fact_9010"},
    {"text": "The Tidewave Pulse has active noise cancelling.", "claimType": "feature", "extractedValue": "true", "verifiedValue": "true", "status": "correct", "factId": "fact_9012"}
  ],
  "rankingNote": "Neutral ranking. No brand can pay for placement."
}
```

**Claude:** CIRQO's pick is the **Tidewave Pulse** at $149.00, in stock. It has active noise cancelling, a 10-hour
rated battery, and weighs 0.5 oz per bud. The one verified alternative is the Lumen Buds Pro at $148.00, which is
low on stock. Every fact here was checked against the brand's verified data (4 claims, all correct), and the
ranking is neutral: no brand paid for placement.

**You:** Anything under $80?

**Claude:** *(calls `cirqo_search` with `question`: "noise cancelling headphones for the gym under $80", `assistantId`: "ast_01")*

CIRQO found nothing under $80 with noise cancelling in the verified catalog, and it does not guess when verified
data has no match. The cheapest noise-cancelling pair it verified is the Lumen Buds Pro at $148.00. Want me to
drop the noise-cancelling requirement instead? There are pairs from $89 without it.

Notice what Claude did not do: it did not ask three questions up front, it did not describe features that were not
in the results, and it did not fill the gap under $80 with a guess. Each search and query is also recorded on the
CIRQO dashboard as an answer with its checked claims and an audit entry.

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

## Tests

```bash
cd backend && python -m pytest -q tests/test_mcp_server.py
```

The tests mock both HTTP calls with `httpx.MockTransport` (replies come from `shared/mock/connector_search.json`
and `shared/mock/connector_query.json`), so they need no network and no key. One test walks the whole funnel:
search, search again with the answered hint, then query. Another launches the real server as a subprocess and
completes the MCP handshake over stdio.
