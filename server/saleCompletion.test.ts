import { describe, expect, it } from "vitest";
import { completeSaleInTransaction } from "./db";

function transactionDouble(selections: unknown[][]) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  let insertId = 51;
  const tx = {
    select: () => ({ from: () => ({ where: async () => selections.shift() ?? [] }) }),
    insert: () => ({ values: async (values: unknown) => { inserts.push(values); return [{ insertId: insertId++ }]; } }),
    update: () => ({ set: (values: unknown) => ({ where: async () => { updates.push(values); } }) }),
  };
  return { tx, inserts, updates };
}

describe("completed sale inventory transaction", () => {
  it("writes a sale, line items, linked stock movements, and resulting ingredient balances", async () => {
    const state = transactionDouble([
      [{ id: 1, sellingPrice: 18000, isActive: true }],
      [{ id: 7, productId: 1 }],
      [{ recipeId: 7, ingredientId: 11, quantity: 0.2 }, { recipeId: 7, ingredientId: 12, quantity: 15 }],
      [{ id: 11, name: "Susu", currentStock: 2, isActive: true }, { id: 12, name: "Kopi", currentStock: 40, isActive: true }],
    ]);
    const result = await completeSaleInTransaction(state.tx, { items: [{ productId: 1, quantity: 2 }] }, "TRX-TEST-01");

    expect(result).toMatchObject({ id: 51, receiptNumber: "TRX-TEST-01", total: 36000 });
    expect(state.inserts[0]).toEqual({ receiptNumber: "TRX-TEST-01", total: 36000 });
    expect(state.inserts[1]).toEqual([{ saleId: 51, productId: 1, quantity: 2, unitPrice: 18000, lineTotal: 36000 }]);
    expect(state.updates).toEqual([{ currentStock: 1.6 }, { currentStock: 10 }]);
    expect(state.inserts[2]).toEqual([
      { ingredientId: 11, saleId: 51, type: "sale", quantityDelta: -0.4, balanceAfter: 1.6, note: "Penjualan TRX-TEST-01" },
      { ingredientId: 12, saleId: 51, type: "sale", quantityDelta: -30, balanceAfter: 10, note: "Penjualan TRX-TEST-01" },
    ]);
  });

  it("rejects insufficient stock before writing sales, lines, balances, or audit movements", async () => {
    const state = transactionDouble([
      [{ id: 1, sellingPrice: 18000, isActive: true }],
      [{ id: 7, productId: 1 }],
      [{ recipeId: 7, ingredientId: 11, quantity: 1 }],
      [{ id: 11, name: "Susu", currentStock: 0.5, isActive: true }],
    ]);
    await expect(completeSaleInTransaction(state.tx, { items: [{ productId: 1, quantity: 1 }] }, "TRX-TEST-02")).rejects.toThrow("Stok bahan tidak mencukupi: Susu.");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });
});
