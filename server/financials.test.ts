import { describe, expect, it } from "vitest";
import { cogsForSnapshots, summarizeFinancialSales, type FinancialSale } from "./financials";

const soldAt = new Date("2026-08-19T03:00:00.000Z");
const coffeeSnapshots = [{ unitQuantity: 1, unitCost: 2000 }];
const replacementSnapshots = [{ unitQuantity: 1, unitCost: 5000 }];

function sale(overrides: Partial<FinancialSale["lines"][number]> = {}, status: FinancialSale["status"] = "completed"): FinancialSale {
  return { id: 1, status, completedAt: soldAt, lines: [{ id: 11, productId: 1, productName: "Kopi Susu", quantity: 2, unitPrice: 10000, lineTotal: 20000, refundedQuantity: 0, exchanges: [], ingredientSnapshots: coffeeSnapshots, ...overrides }] };
}

describe("Financial Core", () => {
  it("uses the immutable sale-time cost snapshot rather than a later ingredient price", () => {
    expect(cogsForSnapshots([{ unitQuantity: 0.2, unitCost: 12000 }, { unitQuantity: 15, unitCost: 200 }])).toBe(5400);
    expect(cogsForSnapshots([{ unitQuantity: 0.2, unitCost: 12000 }, { unitQuantity: 15, unitCost: 200 }], 2)).toBe(10800);
  });

  it("calculates the financial acceptance scenario: revenue, COGS, gross profit, and gross margin", () => {
    const result = summarizeFinancialSales([sale()]);
    expect(result).toMatchObject({ revenue: 20000, cogs: 4000, grossProfit: 16000, grossMargin: 80, saleCount: 1, unitsSold: 2 });
    expect(result.productPerformance).toEqual([{ productId: 1, productName: "Kopi Susu", quantity: 2, revenue: 20000, cogs: 4000, grossProfit: 16000, grossMargin: 80 }]);
  });

  it("reverses revenue and COGS for partial refunds and full void/refund finalization", () => {
    const partialRefund = summarizeFinancialSales([sale({ refundedQuantity: 1 })]);
    expect(partialRefund).toMatchObject({ revenue: 10000, cogs: 2000, grossProfit: 8000, grossMargin: 80, unitsSold: 1 });
    const voided = summarizeFinancialSales([sale({}, "voided")]);
    const refunded = summarizeFinancialSales([sale({}, "refunded")]);
    expect(voided).toMatchObject({ revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, unitsSold: 0 });
    expect(refunded).toMatchObject({ revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, unitsSold: 0 });
  });

  it("replaces returned revenue and COGS with the issued exchange product at its immutable snapshot cost", () => {
    const exchanged = sale({ refundedQuantity: 1, exchanges: [{ id: 7, saleItemId: 11, returnedQuantity: 1, returnedTotal: 10000, replacementTotal: 20000, items: [{ productId: 2, productName: "Kopi Signature", quantity: 1, lineTotal: 20000, ingredientSnapshots: replacementSnapshots }] }] });
    const result = summarizeFinancialSales([exchanged]);
    expect(result).toMatchObject({ revenue: 20000, cogs: 5000, grossProfit: 15000, grossMargin: 75, saleCount: 1, unitsSold: 1 });
    expect(result.productPerformance).toEqual([{ productId: 2, productName: "Kopi Signature", quantity: 1, revenue: 20000, cogs: 5000, grossProfit: 15000, grossMargin: 75 }]);
  });
});
