import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React's dev-only strict mode runs every effect twice. The kit's opening splash marks itself "already played" on the
  // first run and skips itself on the second, so with it on, the splash never plays on `npm run dev`. Production builds
  // never double-run effects, so this changes nothing there.
  reactStrictMode: false,
  // Trace from the repo root so the /mock route can read ../shared/mock/ when deployed.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/mock/*": ["../shared/mock/**/*.json"],
  },
  // Old pages: the swipe funnel is dropped (DECISIONS.md #25); governance pages moved into Claims.
  async redirects() {
    return [
      { source: "/approvals", destination: "/claims/outstanding", permanent: false },
      { source: "/incidents", destination: "/claims/outstanding", permanent: false },
      { source: "/incidents/:id", destination: "/claims/:id", permanent: false },
      { source: "/audit", destination: "/claims/reviewed", permanent: false },
    ];
  },
};

export default nextConfig;
