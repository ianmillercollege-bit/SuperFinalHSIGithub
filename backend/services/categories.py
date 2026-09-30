"""Product categories (BACKEND_CONTRACT.md v1.4.1 section 7c). Plain code, no AI."""

import re

import constants as C

# Laptop words are checked before hardware words: "a laptop with a fast processor" is about laptops.
INFERENCE_ORDER = ["headphones", "phones_tablets", "laptops", "computer_hardware"]


def infer_category(question: str) -> str | None:
    """The category a shopper's question names, or None when it names none."""
    text = question.lower()
    for category in INFERENCE_ORDER:
        if any(re.search(rf"\b{re.escape(word)}", text) for word in C.CATEGORY_WORDS[category]):
            return category
    return None
