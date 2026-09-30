// CIRQO sample data for AI Visibility and Market Position.
// SAMPLE DATA for demos, not real measurements. Every summary number is derived by the
// selectors below, so nothing is typed twice. Rates are 0 to 1 (contract convention).
// Reason labels are placeholder wording: map them to the contract's ruleId list, or drop the
// reasons, before using them with live data.

export type ReasonCode = 'missingStructuredData' | 'fewRecentReviews' | 'returnPolicyUnclear' | 'stockStatusWrong' | 'competitorCited';
export interface PromptResult { assistant: string; rank: number | null; reason?: ReasonCode }
export interface VisibilityPrompt { id: string; text: string; category: string; results: PromptResult[] }
export interface MarketEntry { id: string; name: string; group: 'you' | 'peer' | 'national'; score: number; averageRank: number | null; shareOfVoice: number; recommendationFrequency: number | null }

export const assistants = ["Assistant A", "Assistant B", "Assistant C", "Assistant D"] as const;

// opportunityKey: map to your existing opportunity ids (see Opportunity Gaps).
export const reasons: Record<ReasonCode, { label: string; opportunityKey: string; opportunityTitle: string }> = {
  "missingStructuredData": {
    "label": "Missing structured product data",
    "opportunityKey": "structuredData",
    "opportunityTitle": "Add structured product data"
  },
  "fewRecentReviews": {
    "label": "Few recent reviews",
    "opportunityKey": "recentReviews",
    "opportunityTitle": "Refresh product reviews"
  },
  "returnPolicyUnclear": {
    "label": "Return policy unclear",
    "opportunityKey": "returnPolicy",
    "opportunityTitle": "Publish a clear return policy"
  },
  "stockStatusWrong": {
    "label": "Stock status unclear or wrong",
    "opportunityKey": "stockStatus",
    "opportunityTitle": "Keep stock status up to date"
  },
  "competitorCited": {
    "label": "Competitor cited instead of you",
    "opportunityKey": "shopperQuestions",
    "opportunityTitle": "Answer common shopper questions"
  }
};

export const prompts: VisibilityPrompt[] = [
  {
    "id": "prm_01",
    "text": "best cooler for a weekend camping trip",
    "category": "Coolers",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 2
      },
      {
        "assistant": "Assistant B",
        "rank": 3
      },
      {
        "assistant": "Assistant C",
        "rank": null,
        "reason": "fewRecentReviews"
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "fewRecentReviews"
      }
    ]
  },
  {
    "id": "prm_02",
    "text": "best hard cooler under $600",
    "category": "Coolers",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 1
      },
      {
        "assistant": "Assistant B",
        "rank": 2
      },
      {
        "assistant": "Assistant C",
        "rank": null,
        "reason": "missingStructuredData"
      },
      {
        "assistant": "Assistant D",
        "rank": 3
      }
    ]
  },
  {
    "id": "prm_03",
    "text": "how long does the Alpine 12 Cooler keep ice",
    "category": "Coolers",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 1
      },
      {
        "assistant": "Assistant B",
        "rank": null,
        "reason": "missingStructuredData"
      },
      {
        "assistant": "Assistant C",
        "rank": null,
        "reason": "missingStructuredData"
      },
      {
        "assistant": "Assistant D",
        "rank": 2
      }
    ]
  },
  {
    "id": "prm_04",
    "text": "best backpack for a 3-day hike",
    "category": "Packs",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 3
      },
      {
        "assistant": "Assistant B",
        "rank": 2
      },
      {
        "assistant": "Assistant C",
        "rank": 4
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "fewRecentReviews"
      }
    ]
  },
  {
    "id": "prm_05",
    "text": "lightweight 40 liter hiking pack",
    "category": "Packs",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 1
      },
      {
        "assistant": "Assistant B",
        "rank": null,
        "reason": "missingStructuredData"
      },
      {
        "assistant": "Assistant C",
        "rank": 2
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "missingStructuredData"
      }
    ]
  },
  {
    "id": "prm_06",
    "text": "best insulated water bottle for hiking",
    "category": "Bottles",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 2
      },
      {
        "assistant": "Assistant B",
        "rank": 3
      },
      {
        "assistant": "Assistant C",
        "rank": 3
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "missingStructuredData"
      }
    ]
  },
  {
    "id": "prm_07",
    "text": "steel water bottle that keeps drinks cold for 24 hours",
    "category": "Bottles",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": null,
        "reason": "fewRecentReviews"
      },
      {
        "assistant": "Assistant B",
        "rank": 2
      },
      {
        "assistant": "Assistant C",
        "rank": 1
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "missingStructuredData"
      }
    ]
  },
  {
    "id": "prm_08",
    "text": "gift ideas for someone who loves camping",
    "category": "Gifts",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 4
      },
      {
        "assistant": "Assistant B",
        "rank": 3
      },
      {
        "assistant": "Assistant C",
        "rank": 2
      },
      {
        "assistant": "Assistant D",
        "rank": 4
      }
    ]
  },
  {
    "id": "prm_09",
    "text": "cooler brands with easy returns",
    "category": "Policies",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": null,
        "reason": "returnPolicyUnclear"
      },
      {
        "assistant": "Assistant B",
        "rank": 1
      },
      {
        "assistant": "Assistant C",
        "rank": null,
        "reason": "returnPolicyUnclear"
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "returnPolicyUnclear"
      }
    ]
  },
  {
    "id": "prm_10",
    "text": "is the Trail 40 Pack in stock",
    "category": "Availability",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 1
      },
      {
        "assistant": "Assistant B",
        "rank": null,
        "reason": "stockStatusWrong"
      },
      {
        "assistant": "Assistant C",
        "rank": null,
        "reason": "stockStatusWrong"
      },
      {
        "assistant": "Assistant D",
        "rank": 2
      }
    ]
  },
  {
    "id": "prm_11",
    "text": "best small outdoor gear brands",
    "category": "Brands",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": null,
        "reason": "competitorCited"
      },
      {
        "assistant": "Assistant B",
        "rank": 4
      },
      {
        "assistant": "Assistant C",
        "rank": 3
      },
      {
        "assistant": "Assistant D",
        "rank": null,
        "reason": "competitorCited"
      }
    ]
  },
  {
    "id": "prm_12",
    "text": "durable cooler for boat trips",
    "category": "Coolers",
    "results": [
      {
        "assistant": "Assistant A",
        "rank": 2
      },
      {
        "assistant": "Assistant B",
        "rank": null,
        "reason": "fewRecentReviews"
      },
      {
        "assistant": "Assistant C",
        "rank": null,
        "reason": "missingStructuredData"
      },
      {
        "assistant": "Assistant D",
        "rank": 3
      }
    ]
  }
];

// averageRank and recommendationFrequency are null for your business: derive them with the selectors.
export const market: MarketEntry[] = [
  {
    "id": "biz_you",
    "name": "Your business",
    "group": "you",
    "score": 63,
    "averageRank": null,
    "shareOfVoice": 0.08,
    "recommendationFrequency": null
  },
  {
    "id": "biz_p1",
    "name": "Cedar & Pine Outfitters",
    "group": "peer",
    "score": 71,
    "averageRank": 2.0,
    "shareOfVoice": 0.09,
    "recommendationFrequency": 0.66
  },
  {
    "id": "biz_p2",
    "name": "Lakeshore Gear Co.",
    "group": "peer",
    "score": 66,
    "averageRank": 2.3,
    "shareOfVoice": 0.08,
    "recommendationFrequency": 0.6
  },
  {
    "id": "biz_p3",
    "name": "Ridgeway Supply",
    "group": "peer",
    "score": 59,
    "averageRank": 2.9,
    "shareOfVoice": 0.05,
    "recommendationFrequency": 0.5
  },
  {
    "id": "biz_p4",
    "name": "Copperline Goods",
    "group": "peer",
    "score": 52,
    "averageRank": 3.4,
    "shareOfVoice": 0.04,
    "recommendationFrequency": 0.42
  },
  {
    "id": "biz_n1",
    "name": "National Brand A",
    "group": "national",
    "score": 88,
    "averageRank": 1.3,
    "shareOfVoice": 0.21,
    "recommendationFrequency": 0.85
  },
  {
    "id": "biz_n2",
    "name": "National Brand B",
    "group": "national",
    "score": 82,
    "averageRank": 1.6,
    "shareOfVoice": 0.18,
    "recommendationFrequency": 0.79
  },
  {
    "id": "biz_n3",
    "name": "National Brand C",
    "group": "national",
    "score": 79,
    "averageRank": 1.9,
    "shareOfVoice": 0.15,
    "recommendationFrequency": 0.71
  },
  {
    "id": "biz_n4",
    "name": "National Brand D",
    "group": "national",
    "score": 74,
    "averageRank": 2.4,
    "shareOfVoice": 0.12,
    "recommendationFrequency": 0.63
  }
];

export const currentScore = 63;
export const opportunityLiftPoints = [5, 4, 3, 2, 1];

// ---------- selectors (pure) ----------
const cells = () => prompts.flatMap((p) => p.results);
export const totalAnswers = () => cells().length;
export const recommendedAnswers = () => cells().filter((r) => r.rank !== null).length;
export const recommendationFrequency = () => recommendedAnswers() / totalAnswers();
export const missedAnswers = () => totalAnswers() - recommendedAnswers();
export const averageRank = () => { const r = cells().filter((c) => c.rank !== null).map((c) => c.rank as number); return r.reduce((a, b) => a + b, 0) / r.length; };
export const perAssistant = () => assistants.map((a) => {
  const mine = cells().filter((c) => c.assistant === a);
  const rec = mine.filter((c) => c.rank !== null);
  return { assistant: a, recommended: rec.length, total: mine.length, frequency: rec.length / mine.length, averageRank: rec.reduce((s, c) => s + (c.rank as number), 0) / rec.length };
});
export const missedByReason = () => {
  const counts: Partial<Record<ReasonCode, number>> = {};
  cells().forEach((c) => { if (c.reason) counts[c.reason] = (counts[c.reason] ?? 0) + 1; });
  return (Object.entries(counts) as [ReasonCode, number][]).map(([reason, count]) => ({ reason, count, ...reasons[reason] })).sort((a, b) => b.count - a.count);
};
export const promptsAffectedBy = (reason: ReasonCode) => prompts.filter((p) => p.results.some((r) => r.reason === reason)).length;
export const totalLiftPoints = () => opportunityLiftPoints.reduce((a, b) => a + b, 0);

// Your row with derived values filled in, then everything ranked by score.
export const marketWithYou = (score: number = currentScore): MarketEntry[] =>
  market.map((m) => m.group === 'you' ? { ...m, score, averageRank: averageRank(), recommendationFrequency: recommendationFrequency() } : m).sort((a, b) => b.score - a.score);
export const rankOverall = (score: number = currentScore) => marketWithYou(score).findIndex((m) => m.group === 'you') + 1;
export const rankAmongSmallBusinesses = (score: number = currentScore) => marketWithYou(score).filter((m) => m.group !== 'national').findIndex((m) => m.group === 'you') + 1;
export const representation = () => ({
  national: market.filter((m) => m.group === 'national').reduce((s, m) => s + m.shareOfVoice, 0),
  peers: market.filter((m) => m.group === 'peer').reduce((s, m) => s + m.shareOfVoice, 0),
  you: market.filter((m) => m.group === 'you').reduce((s, m) => s + m.shareOfVoice, 0),
});
