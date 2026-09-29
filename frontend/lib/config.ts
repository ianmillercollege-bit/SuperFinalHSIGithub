// App-wide switches, read from environment variables at build time.
// Restart `npm run dev` (or redeploy) after changing them.

/** NEXT_PUBLIC_USE_MOCK=true: load example data instead of the live backend. */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

