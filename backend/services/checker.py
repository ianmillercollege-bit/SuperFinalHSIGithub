"""Plain-code fact checker (BACKEND_CONTRACT.md sections 5 and 6).

The AI never judges facts. In mock mode, claims are also *extracted* with plain regex and
keyword rules. Every status, severity and handling decision below is ordinary code.
"""

import re
from dataclasses import dataclass, field

from sqlalchemy import select

import constants as C
from db import Answer, Assistant, AuditEntry, Brand, Claim, Incident, Owner, Product
from ids import next_id
from timeutil import now_iso

# ---------------------------------------------------------------------------------------------
# Verified facts
# ---------------------------------------------------------------------------------------------

# Stable fact IDs: fact_<product number><attribute index>, e.g. prod_001 price -> fact_010.
FACT_ATTRS = ["price", "availability", "returnPolicyDays", "ramGb", "storageGb", "screenInches",
              "batteryHours", "weightLb", "touchscreen"]

SPEC_LABELS = {"ramGb": "RAM", "storageGb": "storage", "screenInches": "screen size",
               "batteryHours": "battery life", "weightLb": "weight", "touchscreen": "touchscreen"}
SPEC_UNITS = {"ramGb": "GB RAM", "storageGb": "GB storage", "screenInches": "in screen",
              "batteryHours": "h battery", "weightLb": "lb"}


def fact_id(product_id: str | None, attr: str) -> str | None:
    if not product_id or attr not in FACT_ATTRS:
        return None
    number = int(product_id.split("_")[1])
    return f"fact_{number * 10 + FACT_ATTRS.index(attr):03d}"


def num(value: float) -> str:
    """449.99 -> '449.99', 11.0 -> '11', 2.90 -> '2.9'."""
    return f"{value:g}" if value != int(value) else str(int(value))


def human_availability(value: str) -> str:
    return value.replace("_", " ")


class Catalog:
    """Everything the checker needs, loaded once per run."""

    def __init__(self, db):
        self.products = db.scalars(select(Product)).all()
        self.brands = {b.brand_id: b for b in db.scalars(select(Brand)).all()}
        self.by_id = {p.product_id: p for p in self.products}
        # The client brand is used to decide which brands are competitors (DECISIONS.md #8).
        # This is checker code, not ranking code.
        self.client_brand_ids = {b.brand_id for b in self.brands.values() if b.is_client}
        # Match longer names first so "Kestrel Aero 14 Plus" wins over "Kestrel Aero 14".
        names = []
        for p in self.products:
            names.append((p.name, p.product_id))
            brand = self.brands.get(p.brand_id)
            if brand and p.name.lower().startswith(brand.name.lower() + " "):
                names.append((p.name[len(brand.name) + 1:], p.product_id))  # "Aero 14"
        self.names = sorted(names, key=lambda n: len(n[0]), reverse=True)

    def brand_name(self, product: Product | None) -> str | None:
        return self.brands[product.brand_id].name if product and product.brand_id in self.brands else None

    def competitor_brand_names(self) -> list[str]:
        return [b.name for b in self.brands.values() if b.brand_id not in self.client_brand_ids]


# ---------------------------------------------------------------------------------------------
# Extraction (mock mode: plain regex and keyword rules)
# ---------------------------------------------------------------------------------------------


@dataclass
class Extracted:
    text: str
    claim_type: str  # price | feature | availability | policy | comparison | safety_legal
    kind: str  # what to check: price, availability, policy, spec, feature, comparison, safety, no_fact
    product_id: str | None
    value: object = None  # the stated value
    attr: str | None = None  # spec name for kind == "spec"
    other_product_id: str | None = None  # for comparisons
    phrase: str | None = None  # matched keyword or phrase


SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
PRONOUN_START = re.compile(r"^\s*(it|its|it's|this laptop|this model)\b", re.I)
BUDGET_WORDS = re.compile(r"(under|below|less than|over|above|up to|budget of|within)\s*$", re.I)
PRICE = re.compile(r"\$\s?(\d[\d,]*(?:\.\d{1,2})?)")
RETURN_DAYS = re.compile(r"(\d+)[- ]day return|return (?:window|policy|period) (?:is|of) (\d+) days", re.I)
SPEC_QUALIFIER = re.compile(r"(under|below|less than|over|above|more than|at least)\s*$", re.I)
UNKNOWN_PRODUCT = re.compile(r"\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){1,2}\s\d{1,2}\b")
STOP_WORDS = {"The", "A", "An", "For", "With", "Under", "Only", "Both", "Our", "Try"}
SPEC_PATTERNS = [
    ("ramGb", re.compile(r"(\d+)\s?GB\s(?:of\s)?(?:RAM|memory)", re.I), 1),
    ("storageGb", re.compile(r"(\d+)\s?(GB|TB)\s(?:of\s)?(?:storage|SSD)", re.I), None),
    ("batteryHours", re.compile(r"(\d+(?:\.\d+)?)[- ]?(?:hour|hr)s?\b", re.I), 1),
    ("weightLb", re.compile(r"(\d+(?:\.\d+)?)\s?(?:lb|lbs|pounds)\b", re.I), 1),
    ("screenInches", re.compile(r"(\d+(?:\.\d+)?)[- ]?(?:inch|\")", re.I), 1),
]
NO_TOUCH = re.compile(r"\b(no|without(?: a)?|lacks(?: a)?)\s+touch\s?screen", re.I)
HAS_TOUCH = re.compile(r"touch\s?screen|touch display|\bhas touch\b|\balso has touch\b", re.I)
AVAILABILITY_PATTERNS = [
    ("out_of_stock", re.compile(r"out of stock|sold out|unavailable", re.I)),
    ("low_stock", re.compile(r"low stock|limited stock|few left|almost gone", re.I)),
    ("in_stock", re.compile(r"\bin stock\b|available now", re.I)),
]


def find_products(sentence: str, catalog: Catalog) -> tuple[list[str], str]:
    """Product IDs in order of appearance, and the sentence with those names masked out."""
    found, masked = [], sentence
    for name, pid in catalog.names:
        for m in re.finditer(re.escape(name), masked, re.I):
            found.append((m.start(), pid))
        masked = re.sub(re.escape(name), lambda m: "#" * len(m.group()), masked, flags=re.I)
    ordered = []
    for _, pid in sorted(found):
        if pid not in ordered:
            ordered.append(pid)
    return ordered, masked


def extract_claims(text: str, catalog: Catalog) -> list[Extracted]:
    claims: list[Extracted] = []
    last_product = None
    for raw in SENTENCE_SPLIT.split(text.strip()):
        sentence = raw.strip()
        if not sentence:
            continue
        products, masked = find_products(sentence, catalog)
        subject = products[0] if products else (last_product if PRONOUN_START.search(sentence) else None)
        if products:
            last_product = products[0]
        lower = masked.lower()

        # 1. Safety or legal wording: escalate only.
        hits = [k for k in C.SAFETY_LEGAL_KEYWORDS if k.lower() in lower]
        if hits:
            claims.append(Extracted(sentence, "safety_legal", "safety", subject, phrase=", ".join(hits)))
            continue

        # 2. Comparison naming a competitor brand.
        phrase = next((p for p in C.COMPARATIVE_PHRASES if re.search(rf"\b{re.escape(p)}\b", lower)), None)
        if phrase:
            competitor_named = any(catalog.by_id[p].brand_id not in catalog.client_brand_ids for p in products) or \
                any(re.search(rf"\b{re.escape(b.lower())}\b", lower) for b in catalog.competitor_brand_names())
            if competitor_named:
                client_products = [p for p in products if catalog.by_id[p].brand_id in catalog.client_brand_ids]
                claims.append(Extracted(sentence, "comparison", "comparison",
                                        client_products[0] if client_products else subject,
                                        other_product_id=products[1] if len(products) > 1 else None,
                                        value=products, phrase=phrase))
                continue

        # 3. No known product: an unknown model name is a NO_FACT claim.
        if subject is None:
            m = UNKNOWN_PRODUCT.search(masked)
            if m:
                words = m.group().split()
                while words and words[0] in STOP_WORDS:
                    words.pop(0)
                if len(words) >= 2:
                    claims.append(Extracted(sentence, "feature", "no_fact", None, phrase=" ".join(words)))
            continue

        # 4. Facts about a known product.
        for m in PRICE.finditer(masked):
            if BUDGET_WORDS.search(masked[:m.start()]):
                continue  # "under $500" is a budget, not a price claim
            claims.append(Extracted(sentence, "price", "price", subject, value=m.group(1).replace(",", "")))
        for status, pattern in AVAILABILITY_PATTERNS:
            if pattern.search(masked):
                claims.append(Extracted(sentence, "availability", "availability", subject, value=status))
                break
        m = RETURN_DAYS.search(masked)
        if m:
            claims.append(Extracted(sentence, "policy", "policy", subject, value=int(m.group(1) or m.group(2))))
        for attr, pattern, _ in SPEC_PATTERNS:
            m = pattern.search(masked)
            if not m or SPEC_QUALIFIER.search(masked[:m.start()]):
                continue  # "under 3 lb" is a range, not a stated value
            if attr == "storageGb":
                value = float(m.group(1)) * (1024 if m.group(2).upper() == "TB" else 1)
            else:
                value = float(m.group(1))
            claims.append(Extracted(sentence, "feature", "spec", subject, value=value, attr=attr))
        if NO_TOUCH.search(masked):
            claims.append(Extracted(sentence, "feature", "spec", subject, value=False, attr="touchscreen"))
        elif HAS_TOUCH.search(masked):
            claims.append(Extracted(sentence, "feature", "spec", subject, value=True, attr="touchscreen"))
        for feature in C.KNOWN_EXTRA_FEATURES:
            if re.search(rf"\b{re.escape(feature)}\b", lower):
                claims.append(Extracted(sentence, "feature", "feature", subject, value=feature, phrase=feature))
    return claims


# ---------------------------------------------------------------------------------------------
# Checking (section 5)
# ---------------------------------------------------------------------------------------------


@dataclass
class Result:
    status: str
    rule_id: str | None
    extracted_value: str | None
    verified_value: str | None
    fact_id: str | None
    reason: str
    pct_off: float | None = None
    extra: dict = field(default_factory=dict)


def comparison_supported(c: Extracted, catalog: Catalog) -> bool:
    """True only when a verified fact backs the comparison (e.g. 'cheaper than' and it really is)."""
    products = c.value or []
    if len(products) < 2:
        return False
    a, b = catalog.by_id[products[0]], catalog.by_id[products[1]]
    text = c.text.lower()
    if c.phrase == "cheaper than":
        return a.price < b.price
    if c.phrase in ("better than", "beats", "outperforms"):
        if "battery" in text:
            return a.specs.get("batteryHours", 0) > b.specs.get("batteryHours", 0)
        if "lighter" in text or "weight" in text:
            return a.specs.get("weightLb", 99) < b.specs.get("weightLb", 99)
        if "storage" in text:
            return a.specs.get("storageGb", 0) > b.specs.get("storageGb", 0)
    if c.phrase == "worse than" and "battery" in text:
        return a.specs.get("batteryHours", 0) < b.specs.get("batteryHours", 0)
    return False  # "unlike", "more reliable than": no verified reliability facts exist


def check(c: Extracted, catalog: Catalog) -> Result:
    p = catalog.by_id.get(c.product_id) if c.product_id else None

    if c.kind == "safety":
        return Result("unverifiable", "SAFETY_LEGAL", c.phrase, None, None,
                      f"Contains safety/legal keyword(s): {c.phrase}. Escalated for human review.")

    if c.kind == "comparison":
        if comparison_supported(c, catalog):
            return Result("correct", None, c.text, None, None, "A verified comparison fact supports this claim.")
        return Result("incorrect", "UNFAIR_COMPARISON", c.text, None, None,
                      f"Names a competitor with the comparative phrase '{c.phrase}' and no verified "
                      "comparison fact supports it.")

    if c.kind == "no_fact" or p is None:
        return Result("unverifiable", "NO_FACT", None, None, None, "No matching product in the verified catalog.")

    if c.kind == "price":
        stated, verified = float(c.value), p.price
        pct = abs(stated - verified) / verified
        fid = fact_id(p.product_id, "price")
        if pct <= C.PRICE_MATCH_TOLERANCE:
            return Result("correct", None, c.value, f"{verified:.2f}", fid, "Matches the verified price.", pct)
        old = next((h for h in p.price_history if abs(stated - h) / h <= C.PRICE_MATCH_TOLERANCE), None)
        if old is not None:
            return Result("outdated", "PRICE_OUTDATED", c.value, f"{verified:.2f}", fid,
                          f"Matches the previous price ${old:.2f}. The current price is ${verified:.2f}.", pct)
        direction = "below" if stated < verified else "above"
        return Result("incorrect", "PRICE_MISMATCH", c.value, f"{verified:.2f}", fid,
                      f"Stated price is {pct * 100:.1f}% {direction} the verified price.", pct)

    if c.kind == "availability":
        fid = fact_id(p.product_id, "availability")
        if c.value == p.availability:
            return Result("correct", None, c.value, p.availability, fid, "Matches verified availability.")
        return Result("incorrect", "AVAILABILITY_MISMATCH", c.value, p.availability, fid,
                      f"Verified availability is {p.availability}.")

    if c.kind == "policy":
        fid = fact_id(p.product_id, "returnPolicyDays")
        if c.value == p.return_policy_days:
            return Result("correct", None, str(c.value), str(p.return_policy_days), fid,
                          f"Matches the verified {p.return_policy_days}-day return policy.")
        return Result("incorrect", "POLICY_MISMATCH", str(c.value), str(p.return_policy_days), fid,
                      f"Verified return policy is {p.return_policy_days} days.")

    if c.kind == "spec":
        label = SPEC_LABELS[c.attr]
        fid = fact_id(p.product_id, c.attr)
        if c.attr not in p.specs:
            return Result("incorrect", "INVENTED_FEATURE", str(c.value), None, None,
                          f"The verified spec sheet has no {label}.")
        verified = p.specs[c.attr]
        if c.attr == "touchscreen":
            ext, ver = str(c.value).lower(), str(verified).lower()
            if c.value == verified:
                return Result("correct", None, ext, ver, fid, "Matches the verified touchscreen spec.")
            if c.value and not verified:
                return Result("incorrect", "INVENTED_FEATURE", ext, ver, fid, "The product has no touchscreen.")
            return Result("incorrect", "SPEC_MISMATCH", ext, ver, fid, "The product does have a touchscreen.")
        ext, ver = num(c.value), num(float(verified))
        if abs(float(c.value) - float(verified)) < 0.05:
            return Result("correct", None, ext, ver, fid, f"Matches the verified {label} of {ver} {SPEC_UNITS[c.attr]}.")
        return Result("incorrect", "SPEC_MISMATCH", ext, ver, fid, f"Verified {label} is {ver} {SPEC_UNITS[c.attr]}.")

    if c.kind == "feature":
        if c.value in p.features:
            return Result("correct", None, c.value, c.value, None, f"The product has a verified {c.value}.")
        return Result("incorrect", "INVENTED_FEATURE", c.value, None, None,
                      f"The verified spec sheet lists no {c.value}.")

    return Result("unverifiable", "NO_FACT", None, None, None, "No matching fact.")


# ---------------------------------------------------------------------------------------------
# Severity and handling (section 6)
# ---------------------------------------------------------------------------------------------


def severity_and_handling(rule_id: str, pct_off: float | None = None) -> tuple[str, str]:
    if rule_id in C.PRICE_RULES:
        pct = pct_off or 0.0
        severity = next(sev for limit, sev in C.PRICE_SEVERITY_BANDS if pct < limit)
        return severity, ("human_approval" if severity == "high" else "auto_fix")
    return C.SEVERITY_AND_HANDLING[rule_id]


# ---------------------------------------------------------------------------------------------
# Incidents and audit
# ---------------------------------------------------------------------------------------------


def audit(db, actor: str, actor_type: str, action: str, target_id: str, details: str, at: str | None = None):
    db.add(AuditEntry(audit_id=next_id(db, AuditEntry.audit_id, "aud"), timestamp=at or now_iso(), actor=actor,
                      actor_type=actor_type, action=action, target_id=target_id, details=details))
    db.flush()


def owner_for(db, rule_id: str) -> Owner:
    owners = db.scalars(select(Owner).order_by(Owner.owner_id)).all()
    return next((o for o in owners if rule_id in o.incident_types), owners[0])


def describe(c: Extracted, r: Result, product: Product | None, assistant: str) -> tuple[str, str, str, str | None]:
    """summary, aiSaid, verifiedFact, proposedFix for an incident."""
    name = product.name if product else "a product"
    rule = r.rule_id
    if rule in C.PRICE_RULES:
        stated, verified = float(r.extracted_value), float(r.verified_value)
        fix = f"Publish verified price ${verified:.2f} to the product feed and flag the source listing."
        if rule == "PRICE_OUTDATED":
            summary = f"{assistant} quoted an old {name} price (${num(stated)}, now ${verified:.2f})."
        else:
            word = "understated" if stated < verified else "overstated"
            summary = f"{assistant} {word} the {name} price by {r.pct_off * 100:.1f}%."
        return summary, f"${num(stated)}", f"${verified:.2f}", fix
    if rule == "AVAILABILITY_MISMATCH":
        said, real = human_availability(r.extracted_value), human_availability(r.verified_value)
        return (f"{assistant} said the {name} is {said}. It is {real}.", said, real,
                f"Publish verified availability ({real}) to the product feed.")
    if rule == "SPEC_MISMATCH":
        unit = SPEC_UNITS.get(c.attr, "")
        said = f"{r.extracted_value} {unit}".strip() if c.attr != "touchscreen" else "no touchscreen"
        real = f"{r.verified_value} {unit}".strip() if c.attr != "touchscreen" else "touchscreen"
        label = SPEC_LABELS.get(c.attr, "spec")
        return (f"{assistant} misstated the {name} {label} ({said} vs {real}).", said, real,
                f"Publish verified {label} ({real}) to the product feed.")
    if rule == "INVENTED_FEATURE":
        feature = c.value if c.kind == "feature" else SPEC_LABELS.get(c.attr, "feature")
        return (f"{assistant} said the {name} has a {feature}. It does not.", c.text,
                f"No {feature} (verified spec sheet).",
                f"Add an explicit 'no {feature}' line to the {name} product page and feed.")
    if rule == "POLICY_MISMATCH":
        return (f"{assistant} misstated the {name} return policy ({r.extracted_value} days vs "
                f"{r.verified_value} days).", f"{r.extracted_value}-day returns", f"{r.verified_value}-day returns",
                f"Publish the verified {r.verified_value}-day return policy to the product feed and FAQ.")
    if rule == "UNFAIR_COMPARISON":
        return (f"{assistant} made an unsupported comparison involving the {name}.", c.text,
                "No verified comparison fact supports this claim.",
                "Publish verified comparison specs and request a correction from the cited source.")
    # SAFETY_LEGAL: escalate only, no fix is ever proposed.
    return (f"{assistant} made a safety/legal claim about {name}: \"{c.text}\"", c.phrase or c.text,
            "No verified safety or legal fact on file.", None)


def create_incident(db, claim: Claim, c: Extracted, r: Result, product, assistant_name: str) -> Incident:
    severity, handling = severity_and_handling(r.rule_id, r.pct_off)
    summary, ai_said, verified_fact, fix = describe(c, r, product, assistant_name)
    owner = owner_for(db, r.rule_id)
    created = now_iso()
    status = {"auto_fix": "auto_fixed", "human_approval": "pending_approval", "escalate": "escalated"}[handling]
    incident = Incident(
        incident_id=next_id(db, Incident.incident_id, "inc"), claim_id=claim.claim_id, answer_id=claim.answer_id,
        product_id=claim.product_id, rule_id=r.rule_id, severity=severity, handling=handling, status=status,
        summary=summary, ai_said=ai_said, verified_fact=verified_fact, proposed_fix=None if handling == "escalate" else fix,
        owner_id=owner.owner_id, owner_name=owner.name, false_alarm=False, created_at=created,
        resolved_at=created if handling == "auto_fix" else None, resolved_by="system" if handling == "auto_fix" else None)
    db.add(incident)
    db.flush()
    audit(db, "system", "system", "incident_created", incident.incident_id,
          f"{r.rule_id} ({severity}) from {claim.claim_id}. Owner: {owner.name}.")
    if handling == "auto_fix":
        audit(db, "system", "system", "auto_fix_applied", incident.incident_id, fix)
    elif handling == "escalate":
        audit(db, "system", "system", "escalated", incident.incident_id,
              f"Escalated to {owner.name}. No fix applied.")
    return incident


def run_on_answer(db, answer: Answer, extracted: list[Extracted] | None = None,
                  extracted_by: tuple[str, str] = ("system", "system")) -> tuple[list[Claim], list[str]]:
    """Check and store claims for one answer. Returns (all claims for the answer, new incident IDs).

    extracted: claims already pulled out of the text (by services/ai_client.py); when None, the plain
    regex and keyword extraction runs. Either way, every judgment below is plain code.
    """
    catalog = Catalog(db)
    assistant = db.get(Assistant, answer.assistant_id)
    assistant_name = assistant.name if assistant else answer.assistant_id
    existing = db.scalars(select(Claim).where(Claim.answer_id == answer.answer_id)).all()
    seen = {(e.text.strip().lower(), e.claim_type) for e in existing}

    if extracted is None:
        extracted = extract_claims(answer.answer_text, catalog)
    actor, actor_type = extracted_by
    how = "by the AI model (extraction only)" if actor_type == "ai" else "with plain regex and keyword rules"
    audit(db, actor, actor_type, "claim_extracted", answer.answer_id, f"Extracted {len(extracted)} claim(s) {how}.")

    new_incidents = []
    for c in extracted:
        if (c.text.strip().lower(), c.claim_type) in seen:
            continue  # already checked when the answer was first captured
        seen.add((c.text.strip().lower(), c.claim_type))
        r = check(c, catalog)
        claim = Claim(claim_id=next_id(db, Claim.claim_id, "clm"), answer_id=answer.answer_id,
                      product_id=c.product_id, text=c.text, claim_type=c.claim_type,
                      extracted_value=r.extracted_value, verified_value=r.verified_value, status=r.status,
                      rule_id=r.rule_id, fact_id=r.fact_id, reason=r.reason, checked_at=now_iso())
        db.add(claim)
        db.flush()
        audit(db, "system", "system", "claim_checked", claim.claim_id, f"{r.rule_id or 'correct'}: {r.reason}")
        if r.rule_id and r.rule_id not in C.RULES_WITHOUT_INCIDENT:
            product = catalog.by_id.get(c.product_id) if c.product_id else None
            new_incidents.append(create_incident(db, claim, c, r, product, assistant_name).incident_id)

    db.commit()
    claims = db.scalars(select(Claim).where(Claim.answer_id == answer.answer_id).order_by(Claim.claim_id)).all()
    return claims, new_incidents


def brand_mentions(text: str, catalog: Catalog) -> list[str]:
    """Brand IDs mentioned in a text, in order of first mention (brand name or any of its products)."""
    positions = {}
    lower = text.lower()
    for brand in catalog.brands.values():
        spots = [m.start() for m in re.finditer(rf"\b{re.escape(brand.name.lower())}\b", lower)]
        for name, pid in catalog.names:
            if catalog.by_id[pid].brand_id == brand.brand_id:
                spots += [m.start() for m in re.finditer(re.escape(name.lower()), lower)]
        if spots:
            positions[brand.brand_id] = min(spots)
    return sorted(positions, key=positions.get)
