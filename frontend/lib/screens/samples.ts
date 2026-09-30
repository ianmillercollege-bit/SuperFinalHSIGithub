// Example props for each screen view (Kestrel-neutral). Use them to preview a screen before wiring live data.
import type { IncidentCardData } from '../../components/screens/OutstandingView';
import type { ReviewedRow, InsightRow } from '../../components/screens/ReviewedView';
import type { FieldSpec } from '../../components/screens/CheckerView';
import type { Lever } from '../../components/screens/GrowthSimulatorView';
import type { OpportunityDetail } from '../../components/screens/OpportunityGapsView';
import type { ChatMessage } from '../../components/screens/CoachView';
import type { SimTurn } from '../../components/screens/AssistantSimulatorView';

export const sampleIncidents: IncidentCardData[] = [
  { id: 'inc_12', severity: { label: 'High', tone: 'bad' }, status: { label: 'Pending approval', tone: 'warn' }, meta: 'Assistant B · waiting 2 h', owner: 'Pricing lead', title: 'Price shown as $399 for a listed product', aiSaid: '$399', verifiedFact: '$549', rule: 'Price mismatch above the auto-fix limit', note: 'Proposed fix: correct the price in the published feed.' },
  { id: 'inc_13', severity: { label: 'High', tone: 'bad' }, status: { label: 'Pending approval', tone: 'warn' }, meta: 'Assistant B · waiting 5 h', owner: 'Policy lead', title: 'Return window misstated', aiSaid: '60-day returns', verifiedFact: 'Returns within 30 days', rule: 'Policy statement mismatch' },
  { id: 'inc_14', severity: { label: 'Safety', tone: 'dark' }, status: { label: 'Escalated', tone: 'dark' }, meta: 'Assistant C · escalated', owner: 'Legal', title: 'Claim about product overheating', aiSaid: 'May overheat while charging', verifiedFact: 'Reviewed by Legal only', note: 'Escalated only. No automatic fix.', decidable: false },
];
export const sampleReviewed: ReviewedRow[] = [
  { id: 'inc_09', title: 'Stock status wrong', type: 'Availability', outcome: { label: 'Approved', tone: 'ok' }, detail: 'Stock status corrected in the feed.', by: 'Dana Reyes', date: 'Sep 26' },
  { id: 'inc_08', title: 'Battery life outdated', type: 'Feature or spec', outcome: { label: 'Auto-fixed', tone: 'ok' }, detail: 'Spec updated automatically (low risk).', by: 'System', date: 'Sep 25' },
  { id: 'inc_07', title: 'Unfair comparison flagged', type: 'Comparison', outcome: { label: 'Rejected', tone: 'neutral' }, detail: 'Comparison matched published specs. No change.', by: 'Sam Patel', date: 'Sep 24' },
];
export const sampleInsights: InsightRow[] = [
  { who: 'Dana Reyes · today', what: 'Approved the stock status correction.' },
  { who: 'System · today', what: 'Applied a low-risk fix: outdated battery spec.' },
  { who: 'Sam Patel · yesterday', what: 'Rejected an unfair-comparison flag.' },
];
export const sampleCheckerFields: FieldSpec[] = [
  { name: 'product', label: 'Product', type: 'select', options: ['Product A', 'Product B'], half: true },
  { name: 'assistant', label: 'Which AI assistant said it?', type: 'select', options: ['Assistant A', 'Assistant B'], half: true },
  { name: 'text', label: 'What did the AI say?', type: 'textarea', required: true, minLength: 10, maxLength: 1000, placeholder: 'Paste the AI answer or the claim' },
];
export const sampleLevers: Lever[] = [
  { id: 'o1', name: 'Add structured product data', liftPoints: 5 }, { id: 'o2', name: 'Refresh product reviews', liftPoints: 4 },
  { id: 'o3', name: 'Publish a clear return policy', liftPoints: 3 }, { id: 'o4', name: 'Keep stock status up to date', liftPoints: 2 },
  { id: 'o5', name: 'Answer common shopper questions', liftPoints: 1 },
];
export const sampleOpportunities: OpportunityDetail[] = [
  { id: 'o1', title: 'Add structured product data', effort: 'Low', why: 'Assistants could not find price and specs for several tested questions.', liftPoints: 5, revenuePerMonth: 1433, step: 'Add a spec table to your top 10 product pages.' },
  { id: 'o2', title: 'Refresh product reviews', effort: 'Medium', why: 'Few recent reviews were found.', liftPoints: 4, revenuePerMonth: 1147, step: 'Send a review request to recent customers.' },
  { id: 'o3', title: 'Publish a clear return policy', effort: 'Low', why: 'Your return policy was unclear or missing in a few answers.', liftPoints: 3, revenuePerMonth: 860, step: 'Add a one-page policy summary linked from every product page.' },
  { id: 'o4', title: 'Keep stock status up to date', effort: 'Medium', why: 'Stock status was wrong in some answers.', liftPoints: 2, revenuePerMonth: 573, step: 'Publish a stock feed that updates daily.' },
  { id: 'o5', title: 'Answer common shopper questions', effort: 'Low', why: 'A competitor was cited instead of you in some answers.', liftPoints: 1, revenuePerMonth: 287, step: 'Add an FAQ covering the questions shoppers ask most.' },
];
export const sampleMessages: ChatMessage[] = [
  { id: 'm1', role: 'coach', text: "Hi Dana, I'm the demo coach. I give pre-written answers built from your dashboard numbers. What would you like to know?" },
  { id: 'm2', role: 'user', text: 'How can this business increase sales?' },
  { id: 'm3', role: 'coach', text: 'The fastest way is to raise your AI Visibility Score. Three changes cover most of the gap: structured product data (+5 points), fresh reviews (+4) and a clear return policy (+3).', sources: ['Visibility score: 63', 'Top opportunity: structured data (+5)'] },
];
export const sampleTurns: SimTurn[] = [
  { id: 't1', question: 'What is the best laptop under $500 for school?', assistant: 'Assistant A', constraints: ['School', 'Long battery'],
    answer: { text: 'The verified pick is the Model X, priced at $479 with a 12-hour battery.', facts: [{ text: 'Price: $479', status: 'checked' }, { text: 'Battery life: 12 hours', status: 'checked' }, { text: 'In stock', status: 'checked' }], matched: ['School', 'Long battery'], source: 'live' } },
];
