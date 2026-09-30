// Shared types for the CIRQO coach (client, route handler and tests). Money and rates follow the dashboard:
// rates are 0..1, money is whole dollars per month.
export type Effort = 'Low' | 'Medium' | 'High';

export interface CoachContext {
  business: { name: string; category?: string };
  asOf: string;                                   // ISO date
  dataLabel: 'sample' | 'live' | 'mixed';
  visibility?: {
    score: number; previousScore: number; recommendationFrequency: number;
    answersTested: number; answersRecommended: number; answersMissed: number;
    strongestAssistant?: { name: string; frequency: number }; weakestAssistant?: { name: string; frequency: number };
    missReasons: { label: string; count: number; fix: string }[];
  };
  market?: {
    rankAmongSmallBusinesses: number; smallBusinessCount: number; rankOverall: number; businessCount: number;
    shareOfVoice: number; nationalShare: number; peerShare: number;
    scoreIfAllGapsClosed?: number; rankOverallIfAllGapsClosed?: number; rankSmallIfAllGapsClosed?: number;
  };
  revenue?: { estimatePerMonth: number; perVisibilityPoint: number; queriesPerMonth: number; conversionPct: number; averageOrderValue: number };
  opportunities?: { title: string; effort: Effort; liftPoints: number; revenuePerMonth: number; why?: string; firstStep?: string }[];
  weeklyScores?: number[];
  trust?: { accuracyRate: number; hallucinationRate: number; timeToResolveHours: number; days: number; accuracyRateStart: number };
  claims?: { outstanding: number; reviewedLast30Days: number };
  competitors?: { name: string; type: 'small business' | 'national brand'; score: number; averageRank: number; shareOfVoice: number; recommendationFrequency: number }[];
  assistants?: { name: string; frequency: number; answersRecommended: number; answersTested: number }[];
  topMissedQuestions?: { question: string; missedBy: string[]; reason?: string }[];
  sampleSections?: string[];                      // sections that come from sample data, so answers can say so
  derivedFacts?: string[];                        // computed by code (see facts.ts); safe for the model to quote
}

export interface ActionItem {
  id: string; title: string; why: string; expectedImpact: string; effort: Effort; metric: string;
  steps: string[]; basedOn: string[];
}
export interface CoachSource { label: string; value: string }
export type CoachMode = 'live' | 'sample' | 'fallback';
export interface CoachReply {
  answer: string; actions: ActionItem[]; sources: CoachSource[];
  mode: CoachMode; verified: boolean; unverifiedNumbers?: string[]; generatedAt: string; note?: string;
}
export interface CoachTurn { role: 'user' | 'coach'; text: string }
export interface CoachRequest { question: string; history: CoachTurn[]; context: CoachContext }
export interface Coach { ask(req: CoachRequest): Promise<CoachReply> }

export const LIMITS = { question: 500, historyTurns: 6, historyChars: 500, contextBytes: 20000 } as const;
export const PLAN_QUESTION = 'What are the top actions I should take next to increase revenue and improve my AI visibility?';
