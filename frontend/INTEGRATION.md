# Plugging in real data

Pages never change when data goes live. Each switch below is one file.

## Real AI metrics

1. Lead adds the endpoint to `BACKEND_CONTRACT.md`.
2. In `lib/api.ts`, replace the matching stub (`getOverviewLive`, `getVisibilityLive`, `getMarketLive`,
   `getOpportunitiesLive`, `getSimulatorBaselineLive`) with a real call, like `getVisibilitySummary()`.
3. Update `lib/schema.ts` to the contract's field names if they differ.
4. Set `NEXT_PUBLIC_USE_MOCK=false`. `lib/dataSource.ts` then uses live data. Until a stub is replaced,
   it falls back to sample data and the badge says "Sample data (live endpoint not connected)".

## Real chatbot

1. Lead adds a coach endpoint to the contract (message shape below).
2. Replace the `coachAsk` stub in `lib/api.ts`.
3. Set `NEXT_PUBLIC_COACH_MODE=live`. `lib/coach/index.ts` switches to `apiCoach.ts`, which falls
   back to the sample coach with a note if the endpoint is missing. No AI keys in the frontend, ever.

## Editing sample data

| What | File |
|------|------|
| Business name, category, region | `lib/sample/sampleBusiness.ts` (the only place the name is written) |
| Prompts, assistants, who appeared and why | `lib/sample/visibility.ts` |
| Reason codes and their plain-English text | `lib/sample/reasonCodes.ts` |
| Opportunities (lift points, effort, steps) | `lib/sample/opportunities.ts` |
| Past weekly scores | `lib/sample/overview.ts` |
| Competitors and similar businesses | `lib/sample/market.ts` |
| Revenue assumptions | `lib/config/simulatorAssumptions.ts` |
| Coach questions and answer templates | `lib/coach/sampleCoach.ts` |

Summary numbers (score, counts, shares, revenue) are calculated in `lib/sample/derive.ts`, never typed.
Run `npm run check:sample` after any edit.

## NEEDS LEAD DECISION (contract additions)

1. **Overview** endpoint: score, weekly history, strengths, weaknesses (`Overview` in `lib/schema.ts`).
2. **Visibility report** endpoint: tracked prompts x assistants with appeared/rank/reason codes.
3. **Market report** endpoint: mentions for this business, similar businesses, national competitors.
4. **Opportunities** endpoint: id, title, why, effort, lift points, steps, reason codes.
5. **Simulator baseline** endpoint, or confirm the simulator stays frontend-only.
6. **Coach message**: request `{question, history:[{role,text}]}`, reply `{text, sources:[{label,value}], source}`.
7. **Visibility Score definition**: sample uses round(100 x appearances / prompt-assistant checks).
8. **Revenue estimate method**: sample uses score points x $/point from stated assumptions.
9. **Reason code list**: confirm the six codes in `lib/sample/reasonCodes.ts`.
