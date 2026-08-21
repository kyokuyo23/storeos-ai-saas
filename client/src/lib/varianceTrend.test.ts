import { describe, it, expect } from "vitest";
import { buildVarianceTrendBuckets } from "./varianceTrend";

describe("Variance Trend Aggregation", () => {
  it("builds sorted buckets and calculates summary metrics", () => {
    const history = [
      { startDate: "2026-08-01", endDate: "2026-08-01", summary: { totalAbsoluteVarianceValue: 10000, totalExcessVarianceValue: 2000, okCount: 3, ingredientCount: 5 } },
      { startDate: "2026-08-03", endDate: "2026-08-03", summary: { totalAbsoluteVarianceValue: 15000, totalExcessVarianceValue: 5000, okCount: 2, ingredientCount: 5 } },
      { startDate: "2026-08-02", endDate: "2026-08-02", summary: { totalAbsoluteVarianceValue: 12000, totalExcessVarianceValue: 3000, okCount: 3, ingredientCount: 5 } },
    ];
    const current = { startDate: "2026-08-04", endDate: "2026-08-04", summary: { totalAbsoluteVarianceValue: 18000, totalExcessVarianceValue: 8000, okCount: 1, ingredientCount: 5 } };

    const trend = buildVarianceTrendBuckets(current, history);
    expect(trend.buckets.map((b) => b.startDate)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(trend.maxAbsoluteValue).toBe(18000);
    expect(trend.trendDirection).toBe("increasing");
  });
});
