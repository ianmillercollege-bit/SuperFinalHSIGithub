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

# ---- BACKEND_CONTRACT.md v1.3 section 7b: brand accounts ---------------------------------------

DEFAULT_BRAND_ID = "brand_001"  # Kestrel: used when no brandId is given (v1.2 behaviour)

# Demo-only keys for seeded data (DECISIONS.md #6, CLIENT_API_CONTRACT.md v1.1). Unrelated to the AI key.
DEMO_ACCOUNTS = [  # v1.4 adds the username that logs in with the shared demo password
    {"brandId": "brand_001", "role": "owner", "apiKey": "fd_demo_owner_2026", "username": "maria.lopez@kestrel.example"},
    {"brandId": "brand_001", "role": "viewer", "apiKey": "fd_demo_viewer_2026", "username": "sam.lee@kestrel.example"},
    {"brandId": "brand_002", "role": "owner", "apiKey": "fd_demo_arcton_2026", "username": "priya.shah@arcton.example"},
    {"brandId": "brand_003", "role": "owner", "apiKey": "fd_demo_novex_2026", "username": "lena.ortiz@novex.example"},
]
SHEET_DEMO_COMPANIES = 5  # v1.4: the first five spreadsheet companies are listed as demo accounts too

# ---- BACKEND_CONTRACT.md v1.4.1 section 7c: catalog at scale and login -------------------------

CATEGORIES = ["laptops", "headphones", "phones_tablets", "computer_hardware"]
CATEGORY_DEFAULT_SUBCATEGORY = {"laptops": "Laptop", "headphones": "Headphones", "phones_tablets": "Smartphone",
                                "computer_hardware": "Computer Hardware"}
# Words in a shopper's question that name a category (plain code, no AI). Laptops is the default.
CATEGORY_WORDS = {
    "headphones": ["headphone", "earbud", "earphone", "headset", "in-ear", "ear bud"],
    "phones_tablets": ["phone", "smartphone", "tablet", "ipad"],
    "computer_hardware": ["graphics card", "gpu", "motherboard", "power supply", "psu", "ssd", "hard drive",
                          "storage drive", "ram stick", "memory kit", "monitor", "keyboard", "mouse", "webcam",
                          "router", "docking station", "dock", "pc case", "case fan", "cooler", "cpu", "processor"],
    "laptops": ["laptop", "notebook", "chromebook", "ultrabook"],
}

DEMO_PASSWORD = "cirqo-demo"  # DECISIONS.md #33/#34: every demo account, so judges are never locked out

# The legacy shopper quiz (contract section 7, kept for compatibility) is laptop-only and ranks the
# original demo catalog it was designed for; the connector ranks the whole catalog.
LEGACY_SHOPPER_BRANDS = ["brand_001", "brand_002", "brand_003"]

INCIDENT_RULE_IDS = ["PRICE_MISMATCH", "PRICE_OUTDATED", "SPEC_MISMATCH", "INVENTED_FEATURE", "AVAILABILITY_MISMATCH",
                     "POLICY_MISMATCH", "UNFAIR_COMPARISON", "SAFETY_LEGAL"]

# ---- Input limits (hardening) ----------------------------------------------------------------
# Longer input gets a 422 VALIDATION_ERROR. Generous for real use, small enough that one request
# cannot tie up the server.

MAX_QUESTION_CHARS = 2_000        # connector question, checker queryText
MAX_ANSWER_CHARS = 20_000         # checker answerText (an AI answer is usually under 3,000)
MAX_NAME_CHARS = 200              # approverName, resolverName
MAX_NOTE_CHARS = 2_000            # approval notes
MAX_CLAIMS_PER_ANSWER = 100       # claims checked per answer; the rest are ignored

# ---- BACKEND_CONTRACT.md v1.1 section 7: Connector ------------------------------------------

CONNECTOR_RANKING_NOTE = "Neutral ranking. No brand can pay for placement."
CONNECTOR_SOURCE_ID = "src_brand"  # the brand's own verified feed
# Connector constraint values -> the shopper option IDs that ranking.py understands.
USE_CASES = {"school": "u_school", "work": "u_work", "travel": "u_travel", "media": "u_media"}
MUST_HAVES = {"battery": "s_battery", "light": "s_light", "screen": "s_screen", "touch": "s_touch"}
