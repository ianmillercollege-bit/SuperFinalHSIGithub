// Turns claim/incident records into the three bold groups of the "Latest insights" card, always in this order.
// You decide which of YOUR statuses map to each group (see the app's status values); anything unmapped is left out.
import type { GroupRow, ListGroup } from './types';

export type InsightStatus = 'accepted' | 'needsInfo' | 'escalated';
export interface InsightItem extends GroupRow { status: InsightStatus }

const ORDER: { status: InsightStatus; title: string; tone: ListGroup['tone'] }[] = [
  { status: 'accepted', title: 'Accepted', tone: 'blue' },
  { status: 'needsInfo', title: 'Needs your info', tone: 'orange' },
  { status: 'escalated', title: 'Escalated', tone: 'slate' },
];

// perGroup: newest items first, at most this many per group (keeps the card the same height as its neighbours).
export function buildInsightGroups(items: InsightItem[], perGroup = 1): ListGroup[] {
  return ORDER.map((g) => ({ title: g.title, tone: g.tone, rows: items.filter((i) => i.status === g.status).slice(0, perGroup).map(({ code, detail, href }) => ({ code, detail, href })) }))
    .filter((g) => g.rows.length > 0);
}
