// The values the connector accepts in `constraints` (POST /api/v1/connector/query).
//
// Source: BACKEND_CONTRACT.md section 7, "Connector": `useCase`: school | work | travel | media;
// `mustHave`: battery | light | screen | touch. Change this file only when the contract changes.
// The labels are screen text only; the `value` is what is sent to the backend.

export const CONNECTOR_USE_CASES = [
  { value: "school", label: "School" },
  { value: "work", label: "Work" },
  { value: "travel", label: "Travel" },
  { value: "media", label: "Streaming and media" },
] as const;

export const CONNECTOR_MUST_HAVES = [
  { value: "battery", label: "All-day battery" },
  { value: "light", label: "Lightweight" },
  { value: "screen", label: "Big screen" },
  { value: "touch", label: "Touchscreen" },
] as const;

export type ConnectorUseCase = (typeof CONNECTOR_USE_CASES)[number]["value"];
export type ConnectorMustHave = (typeof CONNECTOR_MUST_HAVES)[number]["value"];
