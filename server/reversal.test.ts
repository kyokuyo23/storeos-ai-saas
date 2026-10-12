import { pgValues, pgWhere } from "./testing/pgFakes";
import { describe, expect, it } from "vitest";
import { reverseSaleInTransaction, reverseSaleWithClient } from "./db";

function transactionDouble(selections: unknown[][]) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const queryResult = (rows: unknown[]) => Object.assign(Promise.resolve(rows), { limit: async () => rows });
  const tx = {
    select: () => ({ from: () => ({ where: () => queryResult(selections.shift() ?? []) }) }),
    insert: () => ({ values: pgValues(async (values: unknown) => { inserts.push(values); return [{ insertId: 1 }]; }) }),
    update: () => ({ set: (values: unknown) => ({ where: async () => { updates.push(values); } }) }),
  };
  return { tx, inserts, updates };
}

describe("sale reversal transaction", () => {
  it("restores exact sale deductions, writes linked refund movements, and marks the sale refunded", async () => {
    const state = transactionDouble([
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ ingredientId: 11, type: "sale", quantityDelta: -0.4 }, { ingredientId: 12, type: "sale", quantityDelta: -30 }],
      [{ id: 11, currentStock: 1.6 }, { id: 12, currentStock: 10 }],
    ]);
    const result = await reverseSaleInTransaction(state.tx, { saleId: 51, type: "refund", reason: "Pesanan dikembalikan" });
    expect(result).toMatchObject({ id: 51, receiptNumber: "TRX-01", status: "refunded" });
    expect(state.updates).toEqual([{ currentStock: 2 }, { currentStock: 40 }, { status: "refunded", reversedAt: expect.any(Date), reversalReason: "Pesanan dikembalikan" }]);
    expect(state.inserts).toEqual([[
      { ingredientId: 11, saleId: 51, type: "refund", quantityDelta: 0.4, balanceAfter: 2, note: "Refund TRX-01 — Pesanan dikembalikan" },
      { ingredientId: 12, saleId: 51, type: "refund", quantityDelta: 30, balanceAfter: 40, note: "Refund TRX-01 — Pesanan dikembalikan" },
    ]]);
  });

  it("prevents a second reversal before writes begin", async () => {
    const state = transactionDouble([[{ id: 51, receiptNumber: "TRX-01", status: "voided" }]]);
    await expect(reverseSaleInTransaction(state.tx, { saleId: 51, type: "refund" })).rejects.toThrow("Transaksi sudah dibatalkan atau direfund.");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("reports a missing sale before writes begin", async () => {
    const state = transactionDouble([[]]);
    await expect(reverseSaleInTransaction(state.tx, { saleId: 88, type: "void" })).rejects.toThrow("Penjualan tidak ditemukan.");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("rolls back stock restoration when the linked audit write fails", async () => {
    const state = { stocks: [1.6, 10], status: "completed" };
    const snapshot = () => ({ stocks: [...state.stocks], status: state.status });
    const restore = (value: ReturnType<typeof snapshot>) => { state.stocks = [...value.stocks]; state.status = value.status; };
    let selectIndex = 0;
    let ingredientUpdateIndex = 0;
    const rows = [
      [{ id: 51, receiptNumber: "TRX-01", status: "completed" }],
      [{ ingredientId: 11, type: "sale", quantityDelta: -0.4 }, { ingredientId: 12, type: "sale", quantityDelta: -30 }],
      [{ id: 11, currentStock: 1.6 }, { id: 12, currentStock: 10 }],
    ];
    const tx = {
      select: () => ({ from: () => ({ where: () => Object.assign(Promise.resolve(rows[selectIndex++] ?? []), { limit: async () => rows[selectIndex - 1] ?? [] }) }) }),
      update: () => ({ set: (values: { currentStock?: number; status?: string }) => ({ where: async () => {
        if (values.currentStock !== undefined) state.stocks[ingredientUpdateIndex++] = values.currentStock;
        if (values.status) state.status = values.status;
      } }) }),
      insert: () => ({ values: pgValues(async () => { throw new Error("Audit gagal ditulis."); }) }),
    };
    const client = { transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const before = snapshot();
      try { return await callback(tx); } catch (error) { restore(before); throw error; }
    } };
    await expect(reverseSaleWithClient(client, { saleId: 51, type: "void" })).rejects.toThrow("Audit gagal ditulis.");
    expect(state).toEqual({ stocks: [1.6, 10], status: "completed" });
  });
});
