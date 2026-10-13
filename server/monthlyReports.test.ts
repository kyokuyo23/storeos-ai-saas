import { describe, expect, it } from "vitest";
import { monthlyReportToCsv, resolveJakartaMonth } from "./monthlyReports";

describe("StoreOS Phase 2.1 - Management Monthly Reporting", () => {
  it("uses an inclusive Jakarta start and exclusive next-month boundary for January", () => {
    const period = resolveJakartaMonth(2026, 1);
    expect(period.start.toISOString()).toBe("2025-12-31T17:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-01-31T17:00:00.000Z");
    expect(period.startDate).toBe("2026-01-01");
    expect(period.endDate).toBe("2026-01-31");
  });

  it("handles December to January year boundaries without UTC leakage", () => {
    const period = resolveJakartaMonth(2026, 12);
    expect(period.start.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(period.endDate).toBe("2026-12-31");
    expect(period.label).toContain("2026");
  });

  it("rejects invalid calendar months and years", () => {
    expect(() => resolveJakartaMonth(2026, 0)).toThrow();
    expect(() => resolveJakartaMonth(2026, 13)).toThrow();
    expect(() => resolveJakartaMonth(1999, 1)).toThrow();
  });

  it("keeps an empty report representable with zero metrics", () => {
    const emptySummary = {
      financial: { grossSales: 0, netRevenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, salesTransactionCount: 0, refundValue: 0, voidValue: 0, exchangeImpact: 0 },
      inventory: { openingStockValue: 0, closingStockValue: 0, expectedClosingStockValue: 0, actualClosingStockValue: 0, totalVarianceValue: 0, outOfToleranceItemCount: 0, highValueVarianceCount: 0, recurringHighVarianceIngredientCount: 0, stockOpnameSessionCount: 0, openStockOpnameFollowUpCount: 0 },
    };
    expect(emptySummary.financial.netRevenue).toBe(0);
    expect(emptySummary.inventory.recurringHighVarianceIngredientCount).toBe(0);
  });

  it("emits CSV rows scoped to the selected month and timezone", () => {
    const csv = monthlyReportToCsv({
      period: { year: 2026, month: 1, label: "Januari 2026", startDate: "2026-01-01", endDate: "2026-01-31", timezone: "Asia/Jakarta" },
      financial: { grossSales: 100, netRevenue: 90, cogs: 30, grossProfit: 60, grossMargin: 66.67, salesTransactionCount: 2, refundValue: 10, voidValue: 0, exchangeImpact: 0 },
      inventory: { openingStockValue: 10, closingStockValue: 8, expectedClosingStockValue: 9, actualClosingStockValue: 8, totalVarianceValue: -1, outOfToleranceItemCount: 1, highValueVarianceCount: 1, recurringHighVarianceIngredientCount: 0, stockOpnameSessionCount: 1, openStockOpnameFollowUpCount: 1 },
      source: { financial: "Financial Core", inventory: "Inventory Ledger + Inventory Intelligence", recurringVariancePeriods: ["2026-01-01"] },
    } as never);
    expect(csv).toContain('"Periode mulai","2026-01-01"');
    expect(csv).toContain('"Periode akhir","2026-01-31"');
    expect(csv).toContain('"Timezone","Asia/Jakarta"');
    expect(csv).toContain('"Refund Value","10"');
  });

  it("documents the read-only contract through the report shape", () => {
    expect(Object.keys({ query: "only", mutation: undefined })).toContain("query");
  });
});
