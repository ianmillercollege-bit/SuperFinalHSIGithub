import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace from the repo root so the /mock route can read ../shared/mock/ when deployed.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/mock/*": ["../shared/mock/**/*.json"],
  },
  // Old pages: the swipe funnel is dropped (DECISIONS.md #25); governance pages moved into Claims.
  async redirects() {
    return [
      { source: "/", destination: "/dashboard", permanent: false },
      { source: "/approvals", destination: "/claims/outstanding", permanent: false },
      { source: "/incidents", destination: "/claims/outstanding", permanent: false },
      { source: "/incidents/:id", destination: "/claims/:id", permanent: false },
      { source: "/audit", destination: "/claims/reviewed", permanent: false },
    ];
  },
};

export default nextConfig;
