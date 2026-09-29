// Coach that asks the backend. The endpoint isn't in the contract yet, so
// coachAsk() throws NotInContractError and this falls back to the sample coach
// with a visible note.
import { NotInContractError, coachAsk } from "../api";
import { sampleCoach } from "./sampleCoach";
import type { CoachProvider } from "./types";

export const LIVE_COACH_NOT_CONNECTED_NOTE = "live coach not connected, showing a sample answer";

export const apiCoach: CoachProvider = {
  async ask(question, history, context) {
    try {
      return { ...(await coachAsk({ question, history })), source: "live" };
    } catch (error) {
      if (!(error instanceof NotInContractError)) throw error;
      const reply = await sampleCoach.ask(question, history, context);
      return { ...reply, fallbackNote: LIVE_COACH_NOT_CONNECTED_NOTE };
    }
  },
};
