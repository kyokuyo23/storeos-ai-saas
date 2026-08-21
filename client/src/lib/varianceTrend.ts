export type VarianceTrendBucket = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  totalAbsoluteVarianceValue: number;
  totalExcessVarianceValue: number;
  outOfToleranceCount: number;
  ingredientCount: number;
};

export type VarianceTrendSummary = {
  buckets: VarianceTrendBucket[];
  averageAbsoluteValue: number;
  averageExcessValue: number;
  maxAbsoluteValue: number;
  trendDirection: "increasing" | "decreasing" | "stable";
};

export function buildVarianceTrendBuckets(
  currentIntelligence: { startDate?: string; endDate?: string; summary?: { totalAbsoluteVarianceValue: number; totalExcessVarianceValue: number; okCount: number; ingredientCount: number } },
  historicalIntelligences: Array<{ startDate?: string; endDate?: string; summary?: { totalAbsoluteVarianceValue: number; totalExcessVarianceValue: number; okCount: number; ingredientCount: number } }>
): VarianceTrendSummary {
  const allEntries = [...historicalIntelligences, currentIntelligence].filter(
    (item): item is { startDate: string; endDate: string; summary: { totalAbsoluteVarianceValue: number; totalExcessVarianceValue: number; okCount: number; ingredientCount: number } } =>
      Boolean(item.startDate && item.endDate && item.summary)
  );

  const buckets: VarianceTrendBucket[] = allEntries.map((entry) => {
    const outOfToleranceCount = Math.max(0, entry.summary.ingredientCount - entry.summary.okCount);
    const [year, month, day] = entry.startDate.split("-").map(Number);
    const dateObj = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    const label = isNaN(dateObj.getTime())
      ? entry.startDate
      : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(dateObj);

    return {
      key: entry.startDate,
      label,
      startDate: entry.startDate,
      endDate: entry.endDate,
      totalAbsoluteVarianceValue: entry.summary.totalAbsoluteVarianceValue,
      totalExcessVarianceValue: entry.summary.totalExcessVarianceValue,
      outOfToleranceCount,
      ingredientCount: entry.summary.ingredientCount,
    };
  });

  buckets.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const totalAbs = buckets.reduce((acc, b) => acc + b.totalAbsoluteVarianceValue, 0);
  const totalExc = buckets.reduce((acc, b) => acc + b.totalExcessVarianceValue, 0);
  const count = buckets.length || 1;

  const averageAbsoluteValue = Number((totalAbs / count).toFixed(2));
  const averageExcessValue = Number((totalExc / count).toFixed(2));
  const maxAbsoluteValue = buckets.reduce((max, b) => Math.max(max, b.totalAbsoluteVarianceValue), 0);

  let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
  if (buckets.length >= 2) {
    const firstHalfAvg = buckets.slice(0, Math.floor(buckets.length / 2)).reduce((acc, b) => acc + b.totalAbsoluteVarianceValue, 0) / Math.floor(buckets.length / 2);
    const secondHalfAvg = buckets.slice(Math.floor(buckets.length / 2)).reduce((acc, b) => acc + b.totalAbsoluteVarianceValue, 0) / (buckets.length - Math.floor(buckets.length / 2));
    if (secondHalfAvg > firstHalfAvg * 1.05) trendDirection = "increasing";
    else if (secondHalfAvg < firstHalfAvg * 0.95) trendDirection = "decreasing";
  }

  return {
    buckets,
    averageAbsoluteValue,
    averageExcessValue,
    maxAbsoluteValue,
    trendDirection,
  };
}
