"""Neutral ranking (BACKEND_CONTRACT.md sections 7 and 8).

This module must never read isClient, billingTier or any billing field. Products reach it as
RankableProduct, which does not have those fields, so it cannot see who pays.
"""

from pydantic import BaseModel, ConfigDict


class RankableProduct(BaseModel):
    """Only what a shopper can see. Deliberately no brand ownership or billing fields."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    product_id: str
    price: float
    ram_gb: float
    storage_gb: float
    screen_inches: float
    battery_hours: float
    weight_lb: float
    touchscreen: bool


# Swipe card -> does the product have it?
SWIPE_FEATURES = {
    "s_battery": lambda p: p.battery_hours >= 10,
    "s_light": lambda p: p.weight_lb < 3,
    "s_screen": lambda p: p.screen_inches >= 15,
    "s_touch": lambda p: p.touchscreen,
}

# Use case -> (weight, test) pairs; weights add up to 1.
USE_CASE_FIT = {
    "u_school": [(0.5, lambda p: p.battery_hours >= 9), (0.25, lambda p: p.weight_lb < 3.2),
                 (0.25, lambda p: p.ram_gb >= 8)],
    "u_work": [(0.5, lambda p: p.ram_gb >= 8), (0.25, lambda p: p.storage_gb >= 256),
               (0.25, lambda p: p.battery_hours >= 8)],
    "u_travel": [(0.5, lambda p: p.weight_lb < 3), (0.5, lambda p: p.battery_hours >= 10)],
    "u_media": [(0.5, lambda p: p.screen_inches >= 15), (0.25, lambda p: p.storage_gb >= 512),
                (0.25, lambda p: p.ram_gb >= 8)],
}


def liked_share(p: RankableProduct, liked: list[str]) -> float:
    if not liked:
        return 0.0
    return sum(1 for f in liked if SWIPE_FEATURES[f](p)) / len(liked)


def use_fit(p: RankableProduct, use: str | None) -> float:
    return sum(w for w, test in USE_CASE_FIT.get(use, []) if test(p))


def rank(products: list[RankableProduct], budget_limit: float | None, use: str | None,
         liked: list[str]) -> list[tuple[RankableProduct, float]]:
    """Best first. Returns (product, matchScore 0..1)."""
    eligible = [p for p in products if budget_limit is None or p.price < budget_limit]
    scored = [(p, round((liked_share(p, liked) + use_fit(p, use)) / 2, 6)) for p in eligible]
    # Higher score first, then lower price, then productId. Nothing else.
    scored.sort(key=lambda s: (-s[1], s[0].price, s[0].product_id))
    return scored
