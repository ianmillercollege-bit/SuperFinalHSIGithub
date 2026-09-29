"""Every plain-code rule the judges may want to see, in one place.

Sources: DECISIONS.md #7 and #8 (keyword lists), BACKEND_CONTRACT.md sections 5 and 6 (checker,
severity and handling rules) and section 7 (shopper questions). No AI decides any of this.
"""

# ---- DECISIONS.md #8: mock-mode detection keyword lists -------------------------------------

# A claim is an unfair comparison when it names a competitor brand AND uses one of these
# phrases AND no verified comparison fact supports it.
COMPARATIVE_PHRASES = [
    "better than",
    "worse than",
    "unlike",
    "beats",
    "outperforms",
    "cheaper than",
    "more reliable than",
]

# A claim containing any of these is safety/legal: escalate only, never auto-fixed or auto-approved.
SAFETY_LEGAL_KEYWORDS = [
    "safe for",
    "certified",
    "FDA",
    "UL listed",
    "recall",
    "lawsuit",
    "warranty",
    "compliant",
    "child-safe",
    "medical",
    "lifetime guarantee",
]

# Features that are not in the verified spec sheet. Claiming a product has one is an
# invented feature (DECISIONS.md #7: severity high, human approval), unless the product's
# seed data lists it under "features".
KNOWN_EXTRA_FEATURES = [
    "fingerprint reader",
    "face unlock",
    "facial recognition",
    "backlit keyboard",
    "stylus",
    "pen support",
    "oled",
    "5g",
    "lte",
    "thunderbolt",
    "dedicated graphics",
    "gpu",
    "rtx",
    "360-degree hinge",
    "convertible",
    "detachable",
    "waterproof",
    "solar",
]

# ---- BACKEND_CONTRACT.md section 5: checker thresholds ---------------------------------------

PRICE_MATCH_TOLERANCE = 0.01  # within 1% counts as matching

# ---- BACKEND_CONTRACT.md section 6: severity and handling -----------------------------------

# Price rules are graded by how far off the stated price is.
PRICE_SEVERITY_BANDS = [  # (upper bound of percent off, severity)
    (0.05, "low"),
    (0.15, "medium"),
    (float("inf"), "high"),
]

SEVERITY_AND_HANDLING = {
    "AVAILABILITY_MISMATCH": ("medium", "auto_fix"),
    "SPEC_MISMATCH": ("medium", "auto_fix"),
    "INVENTED_FEATURE": ("high", "human_approval"),
    "POLICY_MISMATCH": ("high", "human_approval"),
    "UNFAIR_COMPARISON": ("high", "human_approval"),
    "SAFETY_LEGAL": ("critical", "escalate"),
}

PRICE_RULES = {"PRICE_MISMATCH", "PRICE_OUTDATED"}

# NO_FACT is counted in metrics but never creates an incident.
RULES_WITHOUT_INCIDENT = {"NO_FACT"}

# ---- BACKEND_CONTRACT.md section 7: shopper funnel -------------------------------------------

SHOPPER_QUESTIONS = {
    "openingQuery": "What are the best laptops under $500?",
    "questions": [
        {"questionId": "q_budget", "type": "single", "prompt": "What's your budget?",
         "options": [{"optionId": "b_400", "label": "Under $400"},
                     {"optionId": "b_500", "label": "Under $500"},
                     {"optionId": "b_700", "label": "Under $700"}]},
        {"questionId": "q_use", "type": "single", "prompt": "What will you use it for most?",
         "options": [{"optionId": "u_school", "label": "School"},
                     {"optionId": "u_work", "label": "Work"},
                     {"optionId": "u_travel", "label": "Travel"},
                     {"optionId": "u_media", "label": "Streaming and media"}]},
        {"questionId": "q_swipe", "type": "swipe", "prompt": "Swipe right on what matters to you.",
         "options": [{"optionId": "s_battery", "label": "All-day battery (10h+)"},
                     {"optionId": "s_light", "label": "Lightweight (under 3 lb)"},
                     {"optionId": "s_screen", "label": "Big screen (15 in+)"},
                     {"optionId": "s_touch", "label": "Touchscreen"}]},
    ],
}

BUDGET_LIMITS = {"b_400": 400.0, "b_500": 500.0, "b_700": 700.0}  # price must be under the limit

RANKING_NOTE = "Ranking is neutral. No brand can pay for placement."

# ---- BACKEND_CONTRACT.md v1.1 section 7: Connector ------------------------------------------

CONNECTOR_RANKING_NOTE = "Neutral ranking. No brand can pay for placement."
CONNECTOR_SOURCE_ID = "src_brand"  # the brand's own verified feed
# Connector constraint values -> the shopper option IDs that ranking.py understands.
USE_CASES = {"school": "u_school", "work": "u_work", "travel": "u_travel", "media": "u_media"}
MUST_HAVES = {"battery": "s_battery", "light": "s_light", "screen": "s_screen", "touch": "s_touch"}
