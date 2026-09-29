// Serves example data from the repo's shared/mock/ folder (read-only) when
// NEXT_PUBLIC_USE_MOCK=true. GET /mock/<name> returns shared/mock/<name>.json.
// This route never writes to that folder.

import { readFile } from "node:fs/promises";
import path from "node:path";

const MOCK_DIR = path.join(process.cwd(), "..", "shared", "mock");

// Letters, digits, dash and underscore only, so a request can't escape the folder.
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

export async function GET(_request: Request, ctx: RouteContext<"/mock/[name]">) {
  const { name } = await ctx.params;
  // Errors use the contract's shape: {"error": {"code", "message"}}.
  if (!SAFE_NAME.test(name)) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Invalid mock file name." } },
      { status: 400 },
    );
  }

  try {
    const text = await readFile(path.join(MOCK_DIR, `${name}.json`), "utf8");
    return new Response(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return Response.json(
      { error: { code: "NOT_FOUND", message: `No mock file shared/mock/${name}.json.` } },
      { status: 404 },
    );
  }
}
