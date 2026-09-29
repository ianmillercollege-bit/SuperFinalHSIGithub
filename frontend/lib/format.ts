// The API sends rates as 0 to 1. Use this to show them as a percentage: 0.483 -> "48.3%".
export function formatPercent(rate: number, decimals = 0): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

// 4300 -> "$4,300"
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

// Contract prices are US dollars: 449.99 -> "$449.99"
export function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// 3 -> "+3", -2 -> "-2", 0 -> "0"
export function formatChange(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

// "2026-09-29T17:05:00Z" -> "Sep 29, 5:05 PM UTC"
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

// "2026-09-29" -> "Sep 29"
export function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
