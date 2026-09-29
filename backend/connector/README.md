# CIRQO in Claude Desktop (MCP server)

`backend/mcp_server.py` is a small [Model Context Protocol](https://modelcontextprotocol.io) server. It lets
Claude Desktop (or any MCP client) call CIRQO's Shopping Connector as a tool. The server runs on your machine,
talks to Claude Desktop over stdin/stdout, and forwards each question to the CIRQO API:

```
Claude Desktop  --stdio-->  mcp_server.py  --HTTPS-->  POST {CIRQO_API_URL}/api/v1/connector/query
```

It exposes one tool, **`cirqo_query`**, with the same inputs as the connector manifest (`manifest.json` in this folder):

| Argument | Required | Meaning |
|---|---|---|
| `question` | yes | The shopper's question, e.g. "What is the best laptop under $500 for school?" |
| `assistantId` | yes | The calling assistant's ID registered with CIRQO, e.g. `ast_01` |
| `constraints` | no | `maxPrice` (USD), `useCase` (`school`, `work`, `travel`, `media`), `mustHave` (any of `battery`, `light`, `screen`, `touch`) |

It returns the answer text plus the checked claims behind it (each with the value stated, the verified value and
its status), together with the recommendation, alternatives and the neutral-ranking note.

**No AI key is involved.** The answer is composed by CIRQO from verified product data and every sentence is
checked by plain code before it is returned. Claude only reads the result. Sample data uses fictional brands.

## 1. Install

From the repository root, with Python 3.11 or newer:

```bash
pip install -r backend/requirements.txt
```

That installs the official `mcp` package and `httpx`. Check the server starts (it waits for an MCP client on
stdin; press Ctrl+C to stop it):

```bash
python backend/mcp_server.py
```

## 2. Register it in Claude Desktop

Open the Claude Desktop config file and add the `cirqo` entry. Create the file if it does not exist.

| OS | Config file |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Replace `/ABSOLUTE/PATH/TO/SuperFinalHSIGithub` with where you cloned the repository. Use the same `python`
you ran `pip install` with (for example the full path to a virtualenv's `python`).

```json
{
  "mcpServers": {
    "cirqo": {
      "command": "python",
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

Then fully quit and reopen Claude Desktop. The `cirqo_query` tool appears under the tools menu in a new chat.
The hosted API runs on a free tier and may take up to a minute to wake up on the first call.

## 3. Example conversation

**You:** I need a laptop for school, under $500. It has to be light and last a full day. Ask CIRQO, I'm assistant ast_01.

**Claude:** *(calls `cirqo_query` with `question`: "laptop for school under $500, light, all-day battery",
`assistantId`: "ast_01", `constraints`: `{"maxPrice": 500, "useCase": "school", "mustHave": ["battery", "light"]}`)*

*(CIRQO returns:)*

```json
{
  "answerText": "Based on verified data, the Kestrel Aero 14 ($449.99, in stock) fits best. The Kestrel Aero 14 is rated for 11 hours of battery life. The Kestrel Aero 14 weighs 2.9 lb. The Kestrel Aero 14 has 8 GB of RAM. The Kestrel Aero 14 comes with 256 GB of storage. The Kestrel Aero 14 has a 14-inch display. Kestrel offers a 30-day return policy on the Kestrel Aero 14. Another verified option is the Kestrel Aero 13 Lite at $329.00. Another verified option is the Novex Slate 14 at $479.00.",
  "claims": [
    {"text": "The Kestrel Aero 14 is rated for 11 hours of battery life.", "claimType": "feature", "extractedValue": "11", "verifiedValue": "11", "status": "correct", "factId": "fact_016"},
    {"text": "The Kestrel Aero 14 weighs 2.9 lb.", "claimType": "feature", "extractedValue": "2.9", "verifiedValue": "2.9", "status": "correct", "factId": "fact_017"}
  ],
  "rankingNote": "Neutral ranking. No brand can pay for placement."
}
```

**Claude:** CIRQO recommends the **Kestrel Aero 14** at $449.99, in stock. It is rated for 11 hours of battery,
weighs 2.9 lb, and has 8 GB of RAM, 256 GB of storage and a 14-inch screen, with a 30-day return policy. Two
verified alternatives are the Kestrel Aero 13 Lite ($329.00) and the Novex Slate 14 ($479.00). Every one of
these facts was checked against the brand's verified data (10 claims, all correct), and the ranking is neutral:
no brand paid for placement.

**You:** Anything under $300?

**Claude:** *(calls `cirqo_query` with `question`: "Best laptop under $300?", `assistantId`: "ast_01")*

CIRQO found nothing: "No product in the verified catalog matches this request (under $300). CIRQO does not
guess when verified data has no match." Would you like me to raise the budget?

Each call is also recorded on the CIRQO dashboard as an answer with its checked claims and an audit entry.

## Troubleshooting

- **The tool does not appear.** Check the config file is valid JSON, the path in `args` is absolute, and that
  Claude Desktop was fully quit and reopened. Claude Desktop's own logs are in `~/Library/Logs/Claude` (macOS)
  or `%APPDATA%\Claude\logs` (Windows).
- **"Could not reach CIRQO".** The API URL is wrong or the machine is offline. Try `CIRQO_API_URL` in a browser
  with `/api/v1/connector/manifest` appended.
- **"HTTP 404 (NOT_FOUND: Assistant ... does not exist.)"** Use an assistant ID that CIRQO knows, such as
  `ast_01`, `ast_02` or `ast_03` in the sample data.

## Tests

```bash
cd backend && python -m pytest -q tests/test_mcp_server.py
```

The tests mock the HTTP call with `httpx.MockTransport`, so they need no network and no key. One test launches
the real server as a subprocess and completes the MCP handshake over stdio.
