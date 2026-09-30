// Shown only while the backend has not shipped GET /api/v1/auth/demo-accounts (it answers
// NOT_FOUND). These are the example accounts printed in BACKEND_CONTRACT.md v1.3, section 7b,
// and the screen says they are examples. Delete this file once the endpoint is live.
import type { DemoAccount } from "../types";

export const DEMO_ACCOUNTS_FALLBACK: DemoAccount[] = [
  { brandId: "brand_001", brandName: "Kestrel", role: "owner", apiKey: "fd_demo_owner_2026" },
  { brandId: "brand_002", brandName: "Arcton", role: "owner", apiKey: "fd_demo_arcton_2026" },
  { brandId: "brand_003", brandName: "Novex", role: "owner", apiKey: "fd_demo_novex_2026" },
  { brandId: "brand_001", brandName: "Kestrel", role: "viewer", apiKey: "fd_demo_viewer_2026" },
];
