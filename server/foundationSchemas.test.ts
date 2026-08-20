import { describe, expect, it } from "vitest";
import { ingredientInput, productFinancialInput, productInput, recipeInput, settingsInput, settlementDateRangeInput, stockOpnameFollowUpInput, stockOpnameFollowUpNoteInput } from "./foundationSchemas";

describe("StoreOS Step 2 validation", () => {
  it("rejects an incomplete product", () => {
    expect(productInput.safeParse({ categoryId: 0, name: "", sellingPrice: "abc", costPrice: "", unit: "" }).success).toBe(false);
  });
  it("accepts a complete product and ingredient payload", () => {
    expect(productInput.safeParse({ categoryId: 1, name: "Kopi Susu", sku: "KOP-001", sellingPrice: 18000, costPrice: 7200, unit: "gelas", isActive: true }).success).toBe(true);
    expect(ingredientInput.safeParse({ name: "Susu", unit: "liter", costPerUnit: 22000, minimumStock: 10, isActive: true }).success).toBe(true);
  });
  it("requires a positive-quantity ingredient in a recipe", () => {
    expect(recipeInput.safeParse({ productId: 1, name: "Resep Kopi", items: [] }).success).toBe(false);
    expect(recipeInput.safeParse({ productId: 1, name: "Resep Kopi", items: [{ ingredientId: 2, quantity: 0 }] }).success).toBe(false);
  });
  it("requires valid ordered Jakarta dates for a settlement range", () => {
    expect(settlementDateRangeInput.safeParse({ startDate: "2026-08-10", endDate: "2026-08-19" }).success).toBe(true);
    expect(settlementDateRangeInput.safeParse({ startDate: "2026-08-19", endDate: "2026-08-10" }).success).toBe(false);
    expect(settlementDateRangeInput.safeParse({ startDate: "2026-02-31", endDate: "2026-03-01" }).success).toBe(false);
  });
  it("requires a product and valid ordered dates for financial drill-down reporting", () => {
    expect(productFinancialInput.safeParse({ productId: 7, startDate: "2026-08-01", endDate: "2026-08-19" }).success).toBe(true);
    expect(productFinancialInput.safeParse({ productId: 0, startDate: "2026-08-01", endDate: "2026-08-19" }).success).toBe(false);
    expect(productFinancialInput.safeParse({ productId: 7, startDate: "2026-08-19", endDate: "2026-08-01" }).success).toBe(false);
  });
  it("accepts only a valid audit reference and follow-up status", () => {
    expect(stockOpnameFollowUpInput.safeParse({ reference: "OPN-1724-ABCDE", status: "in_progress" }).success).toBe(true);
    expect(stockOpnameFollowUpInput.safeParse({ reference: "", status: "resolved" }).success).toBe(false);
    expect(stockOpnameFollowUpInput.safeParse({ reference: "OPN-1724-ABCDE", status: "closed" }).success).toBe(false);
  });
  it("accepts a bounded follow-up note and rejects notes that exceed the limit", () => {
    expect(stockOpnameFollowUpNoteInput.safeParse({ reference: "OPN-1724-ABCDE", note: "Selisih telah diverifikasi." }).success).toBe(true);
    expect(stockOpnameFollowUpNoteInput.safeParse({ reference: "OPN-1724-ABCDE", note: "x".repeat(1001) }).success).toBe(false);
  });
  it("requires valid ascending age thresholds for opname priority", () => {
    const base = { businessName: "Kopi Nusantara", storeLocation: "Cibitung Bekasi", currency: "IDR", timezone: "Asia/Jakarta" };
    expect(settingsInput.safeParse({ ...base, opnameWarningAgeDays: 4, opnameCriticalAgeDays: 9 }).success).toBe(true);
    expect(settingsInput.safeParse({ ...base, opnameWarningAgeDays: 7, opnameCriticalAgeDays: 7 }).success).toBe(false);
    expect(settingsInput.safeParse({ ...base, opnameWarningAgeDays: 0, opnameCriticalAgeDays: 7 }).success).toBe(false);
  });
});
