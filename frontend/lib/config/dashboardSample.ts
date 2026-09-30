// Decision-28 exception: the dashboard's sample-only sections come from lib/dashboard/sampleDashboard.ts
// and are switched here. They sit under the global "Sample data" badge, and each one carries its own
// "Sample" tag on screen. Everything the contract supplies (score, trust trend, claim counts, latest
// insights) is always live and is never replaced by sample values.
//
// Sample-only today: Recommendation frequency, Revenue estimate, Opportunity gaps, Top strengths,
// Top weaknesses. Set to false to hide all of them.
export const showSampleSections = true;
