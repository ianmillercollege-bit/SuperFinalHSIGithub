"""ISO 8601 UTC helpers. Timestamps look like 2026-09-29T17:05:00Z (BACKEND_CONTRACT.md section 1)."""

from datetime import date, datetime, timedelta, timezone

FMT = "%Y-%m-%dT%H:%M:%SZ"


def now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def now_iso() -> str:
    return now().strftime(FMT)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime(FMT)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def today() -> date:
    return now().date()


def days_ago_iso(days: int) -> str:
    """Start of the window 'the last N days', as an ISO timestamp for string comparison."""
    return to_iso(now() - timedelta(days=days))


def shift_iso(value: str | None, days: int) -> str | None:
    if value is None or days == 0:
        return value
    return to_iso(parse_iso(value) + timedelta(days=days))


def shift_date(value: str, days: int) -> str:
    return (date.fromisoformat(value) + timedelta(days=days)).isoformat()
