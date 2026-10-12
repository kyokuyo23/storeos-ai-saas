import { pgValues, pgWhere } from "./testing/pgFakes";
import { describe, expect, it } from "vitest";
import { exchangeInTransaction, exchangeWithClient } from "./db";

function transactionDouble(selections: unknown[][], failAtInsert?: number) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  let insertId = 71;
  let insertCount = 0;
  const queryResult = (rows: unknown[]) => Object.assign(Promise.resolve(rows), { limit: async () => rows });
  const tx = {
    select: () => ({ from: () => ({ where: () => queryResult(selections.shift() ?? []) }) }),
    insert: () => ({ values: pgValues(async (values: unknown) => { insertCount += 1; if (failAtInsert === insertCount) throw new Error("Audit penukaran gagal ditulis."); inserts.push(values); return [{ insertId: insertId++ }]; }) }),
    update: () => ({ set: (values: unknown) => ({ where: async () => { updates.push(values); } }) }),
  };
  return { tx, inserts, updates };
}

describe("sale-line exchanges", () => {
  it("supports a same-item exchange with net-zero stock and a zero price difference", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ id: 61, productId: 1, quantity: 2, unitPrice: 10000 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }, { ingredientId: 12, unitQuantity: 15 }],
      [], [],
      [{ id: 1, sellingPrice: 10000, isActive: true }],
      [{ id: 21, productId: 1 }],
      [{ recipeId: 21, ingredientId: 11, quantity: 0.2 }, { recipeId: 21, ingredientId: 12, quantity: 15 }],
      [{ id: 11, name: "Susu", currentStock: 1.6, costPerUnit: 12000, isActive: true }, { id: 12, name: "Kopi", currentStock: 10, costPerUnit: 200, isActive: true }],
    ]);
    const result = await exchangeInTransaction(state.tx, { saleId: 51, saleItemId: 61, returnedQuantity: 1, replacementItems: [{ productId: 1, quantity: 1 }], reason: "Ganti gelas" });
    expect(result).toMatchObject({ saleId: 51, saleItemId: 61, returnedQuantity: 1, returnedTotal: 10000, replacementTotal: 10000, priceDifference: 0, remainingQuantity: 1 });
    expect(state.updates).toEqual([{ currentStock: 1.6 }, { currentStock: 10 }, { status: "partially_refunded" }]);
    expect(state.inserts[0]).toEqual({ saleId: 51, saleItemId: 61, returnedQuantity: 1, returnedTotal: 10000, replacementTotal: 10000, paymentAdjustment: 0, reason: "Ganti gelas" });
    expect(state.inserts[2]).toEqual([{ exchangeItemId: 72, ingredientId: 11, unitQuantity: 0.2, unitCost: 12000 }, { exchangeItemId: 72, ingredientId: 12, unitQuantity: 15, unitCost: 200 }]);
    expect(state.inserts[3]).toEqual([
      { ingredientId: 11, quantityDelta: 0.2, balanceAfter: 1.8, saleId: 51, saleItemId: 61, exchangeId: 71, type: "exchange_return", note: "Penukaran TRX-01 · pengembalian item #61 ×1 — Ganti gelas" },
      { ingredientId: 12, quantityDelta: 15, balanceAfter: 25, saleId: 51, saleItemId: 61, exchangeId: 71, type: "exchange_return", note: "Penukaran TRX-01 · pengembalian item #61 ×1 — Ganti gelas" },
    ]);
    expect(state.inserts[4]).toEqual([
      { ingredientId: 11, quantityDelta: -0.2, balanceAfter: 1.6, saleId: 51, saleItemId: 61, exchangeId: 71, type: "exchange_sale", note: "Penukaran TRX-01 · produk pengganti — Ganti gelas" },
      { ingredientId: 12, quantityDelta: -15, balanceAfter: 10, saleId: 51, saleItemId: 61, exchangeId: 71, type: "exchange_sale", note: "Penukaran TRX-01 · produk pengganti — Ganti gelas" },
    ]);
  });

  it("restores the original recipe, deducts the replacement recipe, and calculates the price difference", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ id: 61, productId: 1, quantity: 2, unitPrice: 10000 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }],
      [], [],
      [{ id: 2, sellingPrice: 18000, isActive: true }],
      [{ id: 22, productId: 2 }],
      [{ recipeId: 22, ingredientId: 12, quantity: 0.25 }],
      [{ id: 11, name: "Susu", currentStock: 1.6, isActive: true }, { id: 12, name: "Biji kopi", currentStock: 1, isActive: true }],
    ]);
    const result = await exchangeInTransaction(state.tx, { saleId: 51, saleItemId: 61, returnedQuantity: 1, replacementItems: [{ productId: 2, quantity: 1 }] });
    expect(result).toMatchObject({ returnedTotal: 10000, replacementTotal: 18000, priceDifference: 8000 });
    expect(state.updates).toEqual([{ currentStock: 1.8 }, { currentStock: 0.75 }, { status: "partially_refunded" }]);
    expect(state.inserts[3]).toHaveLength(1);
    expect(state.inserts[3]).toMatchObject([{ ingredientId: 11, quantityDelta: 0.2, type: "exchange_return" }]);
    expect(state.inserts[4]).toMatchObject([{ ingredientId: 12, quantityDelta: -0.25, type: "exchange_sale" }]);
  });

  it("prevents an exchange beyond the quantity that remains after refunds and earlier exchanges", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "partially_refunded" }],
      [{ id: 61, productId: 1, quantity: 3, unitPrice: 10000 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }],
      [{ quantity: 1 }],
      [{ returnedQuantity: 1 }],
    ]);
    await expect(exchangeInTransaction(state.tx, { saleId: 51, saleItemId: 61, returnedQuantity: 2, replacementItems: [{ productId: 1, quantity: 1 }] })).rejects.toThrow("Jumlah penukaran melebihi sisa item (1).");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("rejects an exchange before writes when stock for the replacement recipe is insufficient", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ id: 61, productId: 1, quantity: 1, unitPrice: 10000 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }],
      [], [],
      [{ id: 2, sellingPrice: 18000, isActive: true }],
      [{ id: 22, productId: 2 }],
      [{ recipeId: 22, ingredientId: 12, quantity: 0.5 }],
      [{ id: 11, name: "Susu", currentStock: 1.6, isActive: true }, { id: 12, name: "Biji kopi", currentStock: 0.1, isActive: true }],
    ]);
    await expect(exchangeInTransaction(state.tx, { saleId: 51, saleItemId: 61, returnedQuantity: 1, replacementItems: [{ productId: 2, quantity: 1 }] })).rejects.toThrow("Stok bahan tidak mencukupi: Biji kopi membutuhkan 0.5, tersedia 0.1.");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("relies on the outer transaction to roll back stock when an exchange audit write fails", async () => {
    const state = { stock: 1.6, status: "completed", exchangeCreated: false };
    const tx = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ id: 61, productId: 1, quantity: 1, unitPrice: 10000 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }],
      [], [],
      [{ id: 1, sellingPrice: 10000, isActive: true }],
      [{ id: 21, productId: 1 }],
      [{ recipeId: 21, ingredientId: 11, quantity: 0.2 }],
      [{ id: 11, name: "Susu", currentStock: 1.6, isActive: true }],
    ], 4).tx;
    const originalUpdate = tx.update;
    tx.update = () => ({ set: (values: { currentStock?: number; status?: string }) => ({ where: async () => { if (values.currentStock !== undefined) state.stock = values.currentStock; if (values.status) state.status = values.status; } }) });
    const client = { transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => { const before = { ...state }; try { return await callback(tx); } catch (error) { Object.assign(state, before); throw error; } } };
    await expect(exchangeWithClient(client, { saleId: 51, saleItemId: 61, returnedQuantity: 1, replacementItems: [{ productId: 1, quantity: 1 }] })).rejects.toThrow("Audit penukaran gagal ditulis.");
    expect(state).toEqual({ stock: 1.6, status: "completed", exchangeCreated: false });
    expect(originalUpdate).toBeTypeOf("function");
  });

  it("blocks exchanges on voided or fully refunded sales before any stock write", async () => {
    const state = transactionDouble([[{ id: 51, receiptNumber: "TRX-01", status: "voided" }]]);
    await expect(exchangeInTransaction(state.tx, { saleId: 51, saleItemId: 61, returnedQuantity: 1, replacementItems: [{ productId: 1, quantity: 1 }] })).rejects.toThrow("Transaksi sudah dibatalkan atau direfund.");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });
});
