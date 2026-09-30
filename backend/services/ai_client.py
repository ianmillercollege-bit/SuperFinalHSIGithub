"""The only place allowed to call the AI provider (BACKEND_CONTRACT.md section 3).

Claude is used for one job: EXTRACTING claims from an AI assistant's answer text. It never judges
them. Every status, severity and handling decision stays in plain code (services/checker.py).

  MOCK_MODE=true                       -> plain regex extraction, "source": "mock" (zero AI calls)
  MOCK_MODE=false, call succeeds       -> Claude extraction,      "source": "live"
  MOCK_MODE=false, no key / error /    -> plain regex extraction, "source": "fallback"
  timeout (30 s) / refusal / bad reply

The AI Coach (section 7f, services/coach.py) makes its one call through coach_call() below, under the
same rules: the model proposes an answer, plain code verifies every number before it is shown.

The API key is read only from the ANTHROPIC_API_KEY environment variable (Render dashboard or a
local .env). It is never written to a file or logged.
"""

import json
import logging
import re
from typing import Literal

import anthropic
from pydantic import BaseModel, ValidationError

import constants as C
from services.checker import SPEC_LABELS, Catalog, Extracted, extract_claims, find_products, usable_number
from settings import settings

log = logging.getLogger("cirqo.ai_client")

TIMEOUT_SECONDS = 30.0
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def source_label() -> str:
    """Label for responses built without calling the AI (plain code over seeded data)."""
    return "mock" if settings.mock_mode else "fallback"


# ---- What Claude must return ---------------------------------------------------------------------


class AIClaim(BaseModel):
    sentence: str
    kind: Literal["price", "availability", "return_policy", "spec", "feature", "comparison", "safety_legal",
                  "unknown_product"]
    product_name: str | None
    spec_name: Literal["ramGb", "storageGb", "screenInches", "batteryHours", "weightLb", "touchscreen"] | None
    stated_value: str | None
    compared_product_name: str | None


class AIClaims(BaseModel):
    claims: list[AIClaim]


CLAIMS_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sentence": {"type": "string"},
                    "kind": {"type": "string", "enum": ["price", "availability", "return_policy", "spec", "feature",
                                                        "comparison", "safety_legal", "unknown_product"]},
                    "product_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "spec_name": {"anyOf": [{"type": "string", "enum": ["ramGb", "storageGb", "screenInches",
                                                                        "batteryHours", "weightLb", "touchscreen"]},
                                            {"type": "null"}]},
                    "stated_value": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "compared_product_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                },
                "required": ["sentence", "kind", "product_name", "spec_name", "stated_value",
                             "compared_product_name"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["claims"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You extract factual product claims from an AI shopping assistant's answer about laptops.

Extract only. Do not judge whether a claim is true; separate code checks every claim against verified data.

For each factual claim, return one entry:
- sentence: the exact sentence from the answer that contains the claim.
- kind: price | availability | return_policy | spec | feature | comparison | safety_legal | unknown_product.
  Use safety_legal for any safety, certification, legal, warranty, recall or medical statement.
  Use unknown_product when the claim is about a laptop that is not in the catalog below.
  Use feature for a feature that is not one of the listed specs (for example a fingerprint reader).
- product_name: the catalog product the claim is about, spelled exactly as in the catalog, or null.
  Resolve pronouns such as "it" to the product they refer to.
- spec_name: for kind spec only: ramGb, storageGb, screenInches, batteryHours, weightLb or touchscreen. Otherwise null.
- stated_value: the value as stated, normalized: price as a number without "$" ("399"); availability as
  in_stock, low_stock or out_of_stock; return_policy as a number of days ("60"); spec as a number in the
  spec's unit (GB, inches, hours, lb) or "true"/"false" for touchscreen; feature as the feature name in
  lowercase ("fingerprint reader"). null for comparison, safety_legal and unknown_product.
- compared_product_name: for comparison only, the other catalog product, spelled exactly as in the catalog.

Ignore budgets and ranges such as "under $500", opinions without a checkable fact, and questions.
Return an empty list if there are no factual claims.

Catalog (brand: products):
{catalog}"""


# ---- Calling Claude ------------------------------------------------------------------------------


def _catalog_text(catalog: Catalog) -> str:
    lines = []
    for brand in sorted(catalog.brands.values(), key=lambda b: b.brand_id):
        names = sorted(p.name for p in catalog.products if p.brand_id == brand.brand_id)
        lines.append(f"{brand.name}: {', '.join(names)}")
    return "\n".join(lines)


def _call_claude(answer_text: str, catalog: Catalog) -> AIClaims | None:
    """One Messages API call with structured output. Returns None on any failure (caller falls back)."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=TIMEOUT_SECONDS, max_retries=0)
    try:
        response = client.beta.messages.create(
            model=settings.ai_model,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",  # server-side retry on another model if this one declines
            system=SYSTEM_PROMPT.format(catalog=_catalog_text(catalog)),
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": CLAIMS_SCHEMA}},
            messages=[{"role": "user", "content": f"Answer to extract claims from:\n\n{answer_text}"}],
        )
    except anthropic.APITimeoutError:
        log.warning("AI extraction timed out after %.0f s; using plain-code extraction.", TIMEOUT_SECONDS)
        return None
    except anthropic.APIConnectionError:
        log.warning("AI extraction could not connect; using plain-code extraction.")
        return None
    except anthropic.APIStatusError as e:
        log.warning("AI extraction failed with HTTP %s; using plain-code extraction.", e.status_code)
        return None

    if response.stop_reason != "end_turn":  # refusal, max_tokens, ...
        log.warning("AI extraction stopped with %s; using plain-code extraction.", response.stop_reason)
        return None
    text = next((b.text for b in response.content if b.type == "text"), None)
    try:
        return AIClaims.model_validate(json.loads(text or ""))
    except (json.JSONDecodeError, ValidationError):
        log.warning("AI extraction returned an unexpected shape; using plain-code extraction.")
        return None


# ---- Turning Claude's list into checker input (plain code) --------------------------------------

CLAIM_TYPES = {"price": "price", "availability": "availability", "return_policy": "policy", "spec": "feature",
               "feature": "feature", "comparison": "comparison", "safety_legal": "safety_legal",
               "unknown_product": "feature"}
NUMBER = re.compile(r"-?\d+(?:\.\d+)?")


def _product_id(name: str | None, catalog: Catalog) -> str | None:
    if not name:
        return None
    found, _ = find_products(name, catalog)
    return found[0] if found else None


def _number(value: str | None) -> float | None:
    m = NUMBER.search((value or "").replace(",", ""))
    return float(m.group()) if m and usable_number(m.group()) else None


def to_checker_input(ai: AIClaims, catalog: Catalog) -> list[Extracted]:
    """Map Claude's extraction onto the checker's input. The safety and comparison rules are
    re-applied here with the fixed keyword lists (DECISIONS.md #8), so plain code, not the AI,
    decides which rule a claim falls under. Anything malformed is dropped."""
    out: list[Extracted] = []
    for c in ai.claims:
        sentence = c.sentence.strip()
        lower = sentence.lower()
        pid = _product_id(c.product_name, catalog)
        claim_type = CLAIM_TYPES[c.kind]

        safety = [k for k in C.SAFETY_LEGAL_KEYWORDS if k.lower() in lower]
        if safety:
            out.append(Extracted(sentence, "safety_legal", "safety", pid, phrase=", ".join(safety)))
            continue

        if c.kind == "comparison":
            phrase = next((p for p in C.COMPARATIVE_PHRASES if re.search(rf"\b{re.escape(p)}\b", lower)), None)
            other = _product_id(c.compared_product_name, catalog)
            products = [p for p in (pid, other) if p]
            competitor = any(catalog.by_id[p].brand_id not in catalog.client_brand_ids for p in products)
            if phrase and competitor:
                client = next((p for p in products if catalog.by_id[p].brand_id in catalog.client_brand_ids), pid)
                out.append(Extracted(sentence, "comparison", "comparison", client, value=products, phrase=phrase,
                                     other_product_id=other))
            continue  # comparisons outside the rule list are not judged

        if c.kind == "unknown_product" or pid is None:
            out.append(Extracted(sentence, "feature", "no_fact", None, phrase=c.product_name))
            continue

        if c.kind == "price" and _number(c.stated_value) is not None:
            out.append(Extracted(sentence, claim_type, "price", pid, value=num_text(_number(c.stated_value))))
        elif c.kind == "availability" and c.stated_value in ("in_stock", "low_stock", "out_of_stock"):
            out.append(Extracted(sentence, claim_type, "availability", pid, value=c.stated_value))
        elif c.kind == "return_policy" and _number(c.stated_value) is not None:
            out.append(Extracted(sentence, claim_type, "policy", pid, value=int(_number(c.stated_value))))
        elif c.kind == "spec" and c.spec_name in SPEC_LABELS:
            if c.spec_name == "touchscreen":
                if (c.stated_value or "").lower() in ("true", "false"):
                    out.append(Extracted(sentence, claim_type, "spec", pid, value=c.stated_value.lower() == "true",
                                         attr="touchscreen"))
            elif _number(c.stated_value) is not None:
                out.append(Extracted(sentence, claim_type, "spec", pid, value=_number(c.stated_value),
                                     attr=c.spec_name))
        elif c.kind == "feature" and c.stated_value:
            out.append(Extracted(sentence, claim_type, "feature", pid, value=c.stated_value.strip().lower(),
                                 phrase=c.stated_value.strip().lower()))
    return out


def num_text(value: float) -> str:
    return str(int(value)) if value.is_integer() else f"{value:g}"


# ---- Public entry point --------------------------------------------------------------------------


def extract(answer_text: str, catalog: Catalog) -> tuple[list[Extracted], str, tuple[str, str]]:
    """Claims from an answer. Returns (claims, source label, (audit actor, actor type))."""
    if settings.mock_mode:
        return extract_claims(answer_text, catalog), "mock", ("system", "system")
    if not settings.anthropic_api_key:
        log.warning("MOCK_MODE=false but ANTHROPIC_API_KEY is not set; using plain-code extraction.")
        return extract_claims(answer_text, catalog), "fallback", ("system", "system")
    ai = _call_claude(answer_text, catalog)
    if ai is None:
        return extract_claims(answer_text, catalog), "fallback", ("system", "system")
    return to_checker_input(ai, catalog), "live", (settings.ai_model, "ai")


# ---- AI Coach (section 7f) -----------------------------------------------------------------------

COACH_MAX_TOKENS = 4000


def coach_call(system: str, user_message: str, schema: dict) -> dict | None:
    """One Messages API call for services/coach.py with structured JSON output. Returns the parsed
    object, or None on timeout, error, refusal or a malformed reply (the coach then falls back).
    Low effort keeps the answer inside the 30-second timeout; the coach verifies it in code."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=TIMEOUT_SECONDS, max_retries=0)
    try:
        response = client.beta.messages.create(
            model=settings.ai_model,
            max_tokens=COACH_MAX_TOKENS,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=system,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APITimeoutError:
        log.warning("AI coach timed out after %.0f s; using the built-in answer.", TIMEOUT_SECONDS)
        return None
    except anthropic.APIConnectionError:
        log.warning("AI coach could not connect; using the built-in answer.")
        return None
    except anthropic.APIStatusError as e:
        log.warning("AI coach failed with HTTP %s; using the built-in answer.", e.status_code)
        return None

    if response.stop_reason != "end_turn":
        log.warning("AI coach stopped with %s; using the built-in answer.", response.stop_reason)
        return None
    text = next((b.text for b in response.content if b.type == "text"), None)
    try:
        parsed = json.loads(text or "")
    except json.JSONDecodeError:
        log.warning("AI coach returned invalid JSON; using the built-in answer.")
        return None
    return parsed if isinstance(parsed, dict) else None
