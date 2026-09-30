import { BUSINESS } from '../business';
import type { DashboardViewModel } from './types';

// Example values for dashboard sections the contract does not supply. Deterministic (no Math.random).
// The adapter replaces firstName and businessName with the real session and lib/business.ts values,
// and overrides any section that live contract data covers.
const ramp = (start: number, end: number, phase: number, n = 30) =>
  Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)) + Math.sin(i * 1.7 + phase) * (Math.abs(end - start) * 0.06) * (1 - i / (n - 1)));

export const sampleDashboard: DashboardViewModel = {
  firstName: 'there',
  businessName: BUSINESS.name,
  score: { value: 63, changeVsLastWeek: 5 },
  stats: [
    { id: 'frequency', label: 'Recommendation frequency', value: '58%', note: 'Up 4 points this week', sample: true },
    { id: 'revenue', label: 'Revenue estimate', value: '$18,060', unit: '/month', pill: 'Illustrative estimate', note: 'Based on your assumptions', sample: true },
    { id: 'outstanding', label: 'Outstanding claims', value: '3', tone: 'bad', note: 'Waiting for approval', href: '/claims/outstanding' },
    { id: 'reviewed', label: 'Claims reviewed', value: '12', tone: 'good', note: 'In the last 30 days', href: '/claims/reviewed' },
  ],
  opportunitiesAreSample: true,
  opportunities: [
    { id: 'o1', title: 'Add structured product data', effort: 'Low', liftPoints: 5, revenuePerMonth: 1433 },
    { id: 'o2', title: 'Refresh product reviews', effort: 'Medium', liftPoints: 4, revenuePerMonth: 1147 },
    { id: 'o3', title: 'Publish a clear return policy', effort: 'Low', liftPoints: 3, revenuePerMonth: 860 },
    { id: 'o4', title: 'Keep stock status up to date', effort: 'Medium', liftPoints: 2, revenuePerMonth: 573 },
    { id: 'o5', title: 'Answer common shopper questions', effort: 'Low', liftPoints: 1, revenuePerMonth: 287 },
  ],
  weeklyScores: [52, 54, 55, 57, 56, 59, 58, 63],
  trust: {
    badge: 'Simulated pilot data',
    series: [
      { key: 'accuracy', label: 'Accuracy', title: '30-day AI accuracy', kind: 'percent', values: ramp(0.72, 0.91, 0.3) },
      { key: 'hallucination', label: 'Hallucination rate', kind: 'percent', values: ramp(0.07, 0.041, 2.6) },
      { key: 'resolve', label: 'Time to resolve', kind: 'hours', values: ramp(9.5, 4.2, 1.1) },
    ],
  },
  lists: [
    { id: 'strengths', title: 'Top strengths', sample: true, rows: [
      { title: 'Strong marketplace reviews', detail: 'Assistants often cite your average rating.' },
      { title: 'Clear prices on product pages', detail: 'Price claims matched your listing in most answers.' },
      { title: 'Accurate product names', detail: 'Assistants identify your products correctly.' },
    ] },
    { id: 'weaknesses', title: 'Top weaknesses', sample: true, rows: [
      { title: 'Missing structured product data', detail: 'Specs could not be found for several tested questions.' },
      { title: 'Return policy is hard to find', detail: 'Unclear or missing in a few answers.' },
      { title: 'Few recent reviews', detail: 'Little fresh review content in the last 90 days.' },
    ] },
    { id: 'insights', title: 'Latest insights', rows: [
      { title: 'Stock status rule updated', detail: 'Answers now show the right availability.' },
      { title: 'A claim needs your info', detail: 'Add a link to your published return policy.' },
      { title: 'Safety concern escalated', detail: 'Sent for review. No automatic fix.' },
    ] },
  ],
  links: { simulator: '/simulator' },  // no /opportunities page in this app, so no button for it
};
