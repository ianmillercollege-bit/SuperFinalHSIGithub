// App-wide switches, read from environment variables at build time.
// Restart `npm run dev` (or redeploy) after changing them.

/** NEXT_PUBLIC_USE_MOCK=true: load example data instead of the live backend. */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type DataMode = "sample" | "live";
/** Where dashboard views get their data. Follows the mock switch above. */
export const dataMode: DataMode = USE_MOCK ? "sample" : "live";

export type CoachMode = "sample" | "live";
/** NEXT_PUBLIC_COACH_MODE=live: send coach questions to the backend. Default: sample. */
export const coachMode: CoachMode =
  process.env.NEXT_PUBLIC_COACH_MODE === "live" ? "live" : "sample";
