// The API sends rates as 0 to 1. Use this to show them as a percentage: 0.483 -> "48.3%".
export function formatPercent(rate: number, decimals = 0): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}
