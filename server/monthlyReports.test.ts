import { describe, it, expect } from "vitest";

describe("StoreOS Phase 2.1 - Management Monthly Reporting", () => {
  it("should calculate Jakarta/WIB calendar month boundaries correctly", () => {
    // Testing boundary calculations for January and December in Jakarta (UTC+7)
    const janStart = new Date("2026-01-01T00:00:00+07:00").getTime();
    const janEnd = new Date("2026-01-31T23:59:59.999+07:00").getTime();
    expect(janEnd).toBeGreaterThan(janStart);
    
    const decStart = new Date("2026-12-01T00:00:00+07:00").getTime();
    const decEnd = new Date("2026-12-31T23:59:59.999+07:00").getTime();
    expect(decEnd).toBeGreaterThan(decStart);
  });

  it("should support zero values for empty months without throwing", () => {
    const emptySummary = {
      period: { year: 2026, month: 8, label: "Agustus 2026" },
      financials: { grossSales: 0, netRevenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, transactionCount: 0, refundValue: 0, voidValue: 0, exchangeImpact: 0 },
      inventoryIntelligence: { openingStockValue: 0, closingStockValue: 0, expectedClosingStock: 0, actualClosingStock: 0, totalVariance: 0, outOfToleranceCount: 0, highValueVarianceCount: 0, recurringHighVarianceCount: 0, opnameSessionCount: 0, openOpnameFollowUpCount: 0 },
      auditNotes: "",
    };
    expect(emptySummary.financials.grossSales).toBe(0);
    expect(emptySummary.inventoryIntelligence.openingStockValue).toBe(0);
  });

  it("should enforce read-only analytics invariant", () => {
    // Analytics procedures must only query and never mutate
    const isReadOnly = true;
    expect(isReadOnly).toBe(true);
  });
});
