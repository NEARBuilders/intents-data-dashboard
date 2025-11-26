export type TrendDirection = "up" | "down" | null;

export function calculateTrend(
  value: number | undefined,
  compareValue: number | undefined,
  lowerIsBetter: boolean = false
): TrendDirection {
  if (value === undefined || compareValue === undefined) return null;
  if (value === compareValue) return null;
  
  const isBetter = lowerIsBetter ? value < compareValue : value > compareValue;
  return isBetter ? "up" : "down";
}

export function getComparisonColor(
  value: number | undefined,
  compareValue: number | undefined,
  lowerIsBetter: boolean = false
): string {
  if (value === undefined || compareValue === undefined) return "text-white";
  if (value === compareValue) return "text-white";
  
  const isBetter = lowerIsBetter ? value < compareValue : value > compareValue;
  return isBetter ? "text-[#aeffed]" : "text-[#ffcccc]";
}

export function formatVolume(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === undefined || value === null) return "N/A";
  return `$${value.toFixed(2)}`;
}

export function formatPercentage(bps: number | undefined): string {
  if (bps === undefined) return "N/A";
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatRate(rate: number | undefined): string {
  if (rate === undefined) return "N/A";
  return rate.toFixed(6);
}
