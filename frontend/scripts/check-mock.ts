// npm run check:mock
// Reports which contract mock files exist in shared/mock/ (read-only) and
// whether each is valid JSON. Real screens start when all are present.
import { readFileSync } from "node:fs";
import path from "node:path";
import { MOCK_FILES } from "../lib/api";

const dir = path.join(__dirname, "..", "..", "shared", "mock");
let ready = 0;
const names = Object.values(MOCK_FILES);

for (const name of names) {
  const file = path.join(dir, `${name}.json`);
  let status: string;
  try {
    JSON.parse(readFileSync(file, "utf8"));
    status = "✓ present";
    ready++;
  } catch (error) {
    status = (error as NodeJS.ErrnoException).code === "ENOENT" ? "· missing" : "✗ invalid JSON";
  }
  console.log(`${status.padEnd(16)} ${name}.json`);
}

console.log(`\n${ready} of ${names.length} mock files ready in shared/mock/.`);
