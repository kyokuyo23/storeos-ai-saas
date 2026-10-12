import { pgValues, pgWhere } from "./testing/pgFakes";
import { describe, expect, it } from "vitest";
import { partialRefundInTransaction, partialRefundWithClient } from "./db";

function transactionDouble(selections: unknown[][]) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  let insertId = 71;
  const queryResult = (rows: unknown[]) => Object.assign(Promise.resolve(rows), { limit: async () => rows });
  const tx = {
    select: () => ({ from: () => ({ where: () => queryResult(selections.shift() ?? []) }) }),
    insert: () => ({ values: pgValues(async (values: unknown) => { inserts.push(values); return [{ insertId: insertId++ }]; }) }),
    update: () => ({ set: (values: unknown) => ({ where: async () => { updates.push(values); } }) }),
  };
  return { tx, inserts, updates };
}

describe("partial sale-line refunds", () => {
  it("restores only the selected quantity of every snapshot ingredient and records the audit link", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ id: 61, productId: 1, quantity: 3 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }, { ingredientId: 12, unitQuantity: 15 }],
      [{ quantity: 1 }],
      [{ id: 11, currentStock: 1.6 }, { id: 12, currentStock: 10 }],
    ]);
    const result = await partialRefundInTransaction(state.tx, { saleId: 51, saleItemId: 61, quantity: 1, reason: "Satu gelas dikembalikan" });
    expect(result).toMatchObject({ saleId: 51, saleItemId: 61, quantity: 1, remainingQuantity: 1 });
    expect(state.inserts[0]).toEqual({ saleId: 51, saleItemId: 61, quantity: 1, reason: "Satu gelas dikembalikan" });
    expect(state.updates).toEqual([{ currentStock: 1.8 }, { currentStock: 25 }, { status: "partially_refunded" }]);
    expect(state.inserts[1]).toEqual([
      { ingredientId: 11, saleId: 51, saleItemId: 61, partialRefundId: 71, type: "partial_refund", quantityDelta: 0.2, balanceAfter: 1.8, note: "Refund sebagian TRX-01 · item #61 ×1 — Satu gelas dikembalikan" },
      { ingredientId: 12, saleId: 51, saleItemId: 61, partialRefundId: 71, type: "partial_refund", quantityDelta: 15, balanceAfter: 25, note: "Refund sebagian TRX-01 · item #61 ×1 — Satu gelas dikembalikan" },
    ]);
  });

  it("rejects refunds above the remaining line quantity before any write", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "partially_refunded" }],
      [{ id: 61, productId: 1, quantity: 2 }],
      [{ ingredientId: 11, unitQuantity: 0.2 }],
      [{ quantity: 1 }],
    ]);
    await expect(partialRefundInTransaction(state.tx, { saleId: 51, saleItemId: 61, quantity: 2 })).rejects.toThrow("Jumlah refund melebihi sisa item (1).");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("rolls back a partial refund when its restoration movement cannot be recorded", async () => {
    const state = { stock: 1.6, status: "completed", refundRecorded: false };
    const tx = {
      select: (() => { const rows = [[{ id: 51, receiptNumber: "TRX-01", status: "completed" }], [{ id: 61, productId: 1, quantity: 2 }], [{ ingredientId: 11, unitQuantity: 0.2 }], [], [{ id: 11, currentStock: 1.6 }]]; let index = 0; return () => ({ from: () => ({ where: () => Object.assign(Promise.resolve(rows[index++] ?? []), { limit: async () => rows[index - 1] ?? [] }) }) }); })(),
      update: () => ({ set: (values: { currentStock?: number; status?: string }) => ({ where: async () => { if (values.currentStock !== undefined) state.stock = values.currentStock; if (values.status) state.status = values.status; } }) }),
      insert: (() => { let count = 0; return () => ({ values: pgValues(async () => { count += 1; if (count === 1) { state.refundRecorded = true; return [{ insertId: 71 }]; } throw new Error("Audit gagal ditulis."); }) }); })(),
    };
    const client = { transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => { const before = { ...state }; try { return await callback(tx); } catch (error) { Object.assign(state, before); throw error; } } };
    await expect(partialRefundWithClient(client, { saleId: 51, saleItemId: 61, quantity: 1 })).rejects.toThrow("Audit gagal ditulis.");
    expect(state).toEqual({ stock: 1.6, status: "completed", refundRecorded: false });
  });
});
