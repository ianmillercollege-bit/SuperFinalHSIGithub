import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trace from the repo root so the /mock route can read ../shared/mock/ when deployed.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/mock/*": ["../shared/mock/**/*.json"],
  },
  // Old pages replaced by the Claims section and the split Insights pages.
  async redirects() {
    return [
      { source: "/approvals", destination: "/claims/outstanding", permanent: false },
      { source: "/incidents", destination: "/claims/outstanding", permanent: false },
      { source: "/incidents/:id", destination: "/claims/outstanding", permanent: false },
      { source: "/audit", destination: "/claims/reviewed", permanent: false },
      { source: "/growth", destination: "/simulator", permanent: false },
    ];
  },
};

export default nextConfig;
