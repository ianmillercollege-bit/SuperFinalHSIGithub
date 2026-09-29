import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace from the repo root so the /mock route can read ../shared/mock/ when deployed.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/mock/*": ["../shared/mock/**/*.json"],
  },
};

export default nextConfig;
