// View model for the CIRQO dashboard. The page builds this from live contract data where the
// contract provides it; every section is optional, and a section without data is not rendered.

export interface StatCardData {
  id: string;
  label: string;
  value: string;              // already formatted, e.g. "58%" or "$18,060"
  unit?: string;              // e.g. "/month"
  tone?: 'default' | 'bad' | 'good';
  note?: string;
  pill?: string;              // e.g. "Illustrative estimate"
  href?: string;              // makes the whole card a link
  sample?: boolean;           // sample-only card: shows a "Sample" tag
}

export interface OpportunityRow { id: string; title: string; effort: string; liftPoints: number; revenuePerMonth: number }
export interface ListRow { title: string; detail: string; href?: string }
export interface ListCardData { id: string; title: string; rows: ListRow[]; emptyText?: string; sample?: boolean }

export type SeriesKind = 'percent' | 'hours';
export interface TrustSeries { key: string; label: string; title?: string; kind: SeriesKind; values: number[] } // percent values are 0..1; title defaults to "<n>-day <label>"

export interface DashboardViewModel {
  firstName: string;
  businessName: string;
  score?: { value: number; changeVsLastWeek: number };
  stats: StatCardData[];
  opportunities?: OpportunityRow[];
  opportunitiesAreSample?: boolean;              // shows a "Sample" tag on the panel
  weeklyScores?: number[];                       // oldest first
  trust?: { series: TrustSeries[]; badge?: string };
  lists: ListCardData[];
  links?: { opportunities?: string; simulator?: string };   // optional buttons in the opportunity panel
}
