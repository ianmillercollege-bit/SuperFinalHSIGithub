"""The connector funnel's plain-code helpers (BACKEND_CONTRACT.md v1.4 section 7c, "Connector search").

Attributes are read from the verified catalog only. Narrowing hints name the attributes on which the
options differ most, phrased as questions an assistant can ask the shopper. No AI, no billing fields.
"""

import re
from statistics import median

from db import Brand, Product

def spec_number(s: dict, key: str, default: float = 0) -> float:
    """A numeric spec, or the default when it is missing or not a number."""
    value = s.get(key)
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else default


def spec_words(s: dict, key: str) -> list[str]:
    """A list-of-strings spec, or [] when it is missing or has another shape."""
    value = s.get(key)
    return [str(x) for x in value] if isinstance(value, list) else []


LEGACY_MUST_HAVES = {  # the laptop words shared with /connector/query
    "battery": lambda s: spec_number(s, "batteryHours") >= 10,
    "light": lambda s: (spec_number(s, "weightLb") or spec_number(s, "weightG", 99999) / 453.592) < 3,
    "screen": lambda s: spec_number(s, "screenInches") >= 15,
    "touch": lambda s: bool(s.get("touchscreen")) or "touch" in str(s.get("displayType", "")).lower(),
}
BOOLEAN_QUESTIONS = {"noiseCancelling": "Do you want noise cancelling?",
                     "wireless": "Do you need it to be wireless?",
                     "touchscreen": "Do you want a touchscreen?"}
NUMBER_WORDS = {1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five"}
# A hint's split key used as a must-have, e.g. "under1oz" or "over10h".
SPLIT_KEY = re.compile(r"^(under|over)(\d+(?:\.\d+)?)(oz|lb|g|h|in|usd)$", re.I)
UNIT_ATTR = {"oz": "weightOz", "lb": "weightLb", "g": "weightG", "h": "batteryHours", "in": "screenInches",
             "usd": "price"}


def brand_verified(brand: Brand | None) -> bool:
    """v1.5 section 7d: facts are verified only for opted-in brands. Until the seed split adds Brand.opted_in,
    every brand's facts come from the verified catalog sheet, so every brand counts as verified (v1.4 behaviour)."""
    return brand is not None and bool(getattr(brand, "opted_in", True))


def boolean_attributes(p: Product) -> dict[str, bool]:
    """Yes/no facts that follow from the verified name and specs."""
    name, s = p.name.lower(), p.specs or {}
    out = {}
    if p.category == "headphones":
        out["noiseCancelling"] = bool(re.search(r"\banc\b|noise[- ]cancel", name))
        out["wireless"] = "wired" not in name and ("wireless" in name or "charging" in str(s.get("ports", "")).lower())
    if p.category in ("laptops", "phones_tablets"):
        out["touchscreen"] = LEGACY_MUST_HAVES["touch"](s) or p.category == "phones_tablets"
    return out


def numeric_attributes(p: Product) -> dict[str, tuple[float, str]]:
    """(value, unit) facts used for weight, battery and price splits."""
    s, out = p.specs or {}, {"price": (p.price, "$")}
    if isinstance(s.get("batteryHours"), (int, float)):
        out["batteryHours"] = (float(s["batteryHours"]), "h")
    if p.category == "headphones" and isinstance(s.get("weightG"), (int, float)):
        out["weightOz"] = (round(float(s["weightG"]) / 28.3495, 1), "oz")
    elif isinstance(s.get("weightLb"), (int, float)):
        out["weightLb"] = (float(s["weightLb"]), "lb")
    elif isinstance(s.get("weightG"), (int, float)):
        out["weightG"] = (float(s["weightG"]), "g")
    if p.category == "laptops" and isinstance(s.get("screenInches"), (int, float)):
        out["screenInches"] = (float(s["screenInches"]), "in")
    return out


def matches_must_have(p: Product, term: str) -> bool:
    """A must-have is a laptop word, a yes/no hint attribute, or a word found in the verified facts."""
    key = term.strip()
    split = SPLIT_KEY.match(key)
    if split:
        side, limit, unit = split.group(1).lower(), float(split.group(2)), split.group(3).lower()
        value = numeric_attributes(p).get(UNIT_ATTR[unit])
        if value is None:
            return False
        return value[0] < limit if side == "under" else value[0] >= limit
    if key.lower() in LEGACY_MUST_HAVES:
        return LEGACY_MUST_HAVES[key.lower()](p.specs or {})
    booleans = {k.lower(): v for k, v in boolean_attributes(p).items()}
    if key.lower() in booleans:
        return booleans[key.lower()]
    s = p.specs or {}
    haystack = " ".join([p.name, p.subcategory or "", " ".join(spec_words(s, "useCaseTags")), str(s.get("ports") or ""),
                         str(s.get("processor") or ""), str(s.get("displayType") or ""),
                         " ".join(spec_words(s, "certifications"))]).lower()
    return key.lower() in haystack


# Words in a question that name a subcategory (the sheet's Product Category). "headphones" is left out on
# purpose: it names the whole category, so over-ear models, earbuds and headsets all stay in.
SUBCATEGORY_WORDS = {
    "Earbuds": ["earbud", "earbuds", "in-ear", "ear bud", "ear buds", "earphone", "earphones"],
    "Headset": ["headset", "headsets"],
    "Smartphone": ["phone", "phones", "smartphone", "smartphones"],
    "Tablet": ["tablet", "tablets", "ipad"],
    "Graphics Card": ["graphics card", "graphics cards", "gpu", "gpus", "video card"],
    "Motherboard": ["motherboard", "motherboards"],
    "Power Supply": ["power supply", "psu"],
    "Storage": ["ssd", "hard drive", "storage drive", "nvme"],
    "Memory": ["ram stick", "ram sticks", "memory kit", "ram"],
    "Monitor": ["monitor", "monitors", "display"],
    "Keyboard": ["keyboard", "keyboards"],
    "Mouse": ["mouse", "mice"],
    "Webcam": ["webcam", "webcams"],
    "Networking": ["router", "routers", "wifi", "wi-fi", "mesh", "network"],
    "Docking Station": ["docking station", "dock"],
    "PC Case": ["pc case", "computer case"],
    "Case Fans": ["case fan", "case fans"],
    "Cooling": ["cooler", "cpu cooler", "cooling", "liquid cooler"],
    "Processor": ["cpu", "processor", "processors"],
}


def subcategories_in(question: str) -> set[str]:
    lower = question.lower()
    return {sub for sub, words in SUBCATEGORY_WORDS.items()
            if any(re.search(rf"\b{re.escape(w)}\b", lower) for w in words)}


def use_case_in(question: str) -> str | None:
    """The first of school, work, travel, media named in the question (laptop ranking uses it)."""
    m = re.search(r"\b(school|work|travel|media)\b", question.lower())
    return m.group(1) if m else None


def product_tags(p: Product) -> frozenset[str]:
    """The words of the product's verified use-case tags."""
    words = set()
    for tag in spec_words(p.specs or {}, "useCaseTags"):
        words.update(re.findall(r"[a-z]+", tag.lower()))
    return frozenset(words)


# Words shoppers use about money or the request itself, never about what the product is for. "budget around
# $150" must not reward products tagged "budget" over products that fit the stated use.
NOT_USE_CASE_WORDS = {"budget", "price", "cheap", "cheapest", "affordable", "new", "need", "want", "best", "good"}


def wanted_tags(question: str, use_case: str | None, candidates: list[Product]) -> list[str]:
    """Question words that are also use-case tags in this category (e.g. "gym"), plus the stated use case."""
    vocabulary = set().union(*(product_tags(p) for p in candidates)) if candidates else set()
    words = [w for w in dict.fromkeys(re.findall(r"[a-z]+", question.lower()))
             if w in vocabulary and len(w) > 2 and w not in NOT_USE_CASE_WORDS]
    if use_case and use_case not in words:
        words.append(use_case)
    return words


def nice_threshold(values: list[float], unit: str) -> float:
    m = median(values)
    if unit == "$":
        return float(round(m / 10) * 10) or m
    return float(round(m)) if m >= 3 else round(m, 1)


def fmt(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def narrowing_hints(options: list[Product], limit: int = 3) -> list[dict]:
    """The attributes on which the options differ most (most even split first), as questions."""
    if len(options) < 2:
        return []
    candidates = []
    order = ["noiseCancelling", "wireless", "touchscreen", "subcategory", "weightOz", "weightLb", "weightG",
             "batteryHours", "screenInches", "price"]

    booleans = [boolean_attributes(p) for p in options]
    for attr in BOOLEAN_QUESTIONS:
        if all(attr in b for b in booleans):
            yes = sum(b[attr] for b in booleans)
            if 0 < yes < len(options):
                candidates.append((min(yes, len(options) - yes), order.index(attr),
                                   {"attribute": attr, "question": BOOLEAN_QUESTIONS[attr],
                                    "splits": {"yes": yes, "no": len(options) - yes}}))

    kinds = [p.subcategory for p in options]
    if len(set(kinds)) > 1:
        counts = {k: kinds.count(k) for k in dict.fromkeys(kinds)}
        names = [k.lower() for k in counts]
        question = f"Do you prefer {', '.join(names[:-1])} or {names[-1]}?"
        candidates.append((min(counts.values()), order.index("subcategory"),
                           {"attribute": "subcategory", "question": question, "splits": counts}))

    numbers = [numeric_attributes(p) for p in options]
    for attr in ("weightOz", "weightLb", "weightG", "batteryHours", "screenInches", "price"):
        if not all(attr in n for n in numbers):
            continue
        values = [n[attr][0] for n in numbers]
        unit = numbers[0][attr][1]
        t = nice_threshold(values, unit)
        under = sum(v < t for v in values)
        if not 0 < under < len(options):
            continue
        word = NUMBER_WORDS.get(under, str(under))
        if attr == "price":
            question, key = f"Is your budget under ${fmt(t)}? {word} of the options are.", f"under{fmt(t)}usd"
            over_key = f"over{fmt(t)}usd"
        elif attr == "batteryHours":
            more = len(options) - under
            question = f"Do you need more than {fmt(t)} hours of battery? {NUMBER_WORDS.get(more, str(more))} last that long."
            key, over_key = f"under{fmt(t)}h", f"over{fmt(t)}h"
        elif attr == "screenInches":
            question, key, over_key = (f"Do you want a bigger screen? {word} are under {fmt(t)} inches.",
                                       f"under{fmt(t)}in", f"over{fmt(t)}in")
        else:
            question = f"Does weight matter? {word} {'is' if under == 1 else 'are'} under {fmt(t)} {unit}."
            key, over_key = f"under{fmt(t)}{unit}", f"over{fmt(t)}{unit}"
        candidates.append((min(under, len(options) - under), order.index(attr),
                           {"attribute": attr, "question": question,
                            "splits": {key: under, over_key: len(options) - under}}))

    candidates.sort(key=lambda c: (-c[0], c[1]))
    hints, seen_weight = [], False
    for _, _, hint in candidates:
        if hint["attribute"].startswith("weight"):
            if seen_weight:
                continue
            seen_weight = True
        hints.append(hint)
        if len(hints) == limit:
            break
    return hints
