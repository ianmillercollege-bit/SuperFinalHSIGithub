"""Prefixed string IDs like inc_12, clm_300, aud_501 (BACKEND_CONTRACT.md section 1)."""

from sqlalchemy import select


def next_id(db, column, prefix: str) -> str:
    """The next free ID for a table, keeping the existing number width (at least 2 digits)."""
    numbers, width = [], 2
    for value in db.scalars(select(column)).all():
        head, _, tail = value.partition("_")
        if head == prefix and tail.isdigit():
            numbers.append(int(tail))
            width = max(width, len(tail))
    return f"{prefix}_{(max(numbers) + 1 if numbers else 1):0{width}d}"
