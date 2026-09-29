import type {
  CoachMessage,
  CoachReply,
  MarketReport,
  OpportunitiesReport,
  Overview,
  SimulatorBaseline,
  VisibilityReport,
} from "../schema";

/** The dashboard data a coach answer can draw on. */
export interface CoachContext {
  overview: Overview;
  visibility: VisibilityReport;
  market: MarketReport;
  opportunities: OpportunitiesReport;
  baseline: SimulatorBaseline;
}

/** Anything that can answer a coach question: the sample coach or the live one. */
export interface CoachProvider {
  ask(question: string, history: CoachMessage[], context: CoachContext): Promise<CoachReply>;
}
