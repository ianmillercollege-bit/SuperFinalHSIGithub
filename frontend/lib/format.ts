// The API sends rates as 0 to 1. Use this to show them as a percentage: 0.483 -> "48.3%".
export function formatPercent(rate: number, decimals = 0): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

// 4300 -> "$4,300"
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

// 3 -> "+3", -2 -> "-2", 0 -> "0"
export function formatChange(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
