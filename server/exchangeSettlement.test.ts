import { pgValues, pgWhere } from "./testing/pgFakes";
import { describe, expect, it } from "vitest";
import { settleExchangeInTransaction, settleExchangeWithClient } from "./db";

function transactionDouble(selections: unknown[][], failAtInsert?: boolean) {
  const inserts: unknown[] = [];
  const queryResult = (rows: unknown[]) => Object.assign(Promise.resolve(rows), { limit: async () => rows });
  const tx = {
    select: () => ({ from: () => ({ where: () => queryResult(selections.shift() ?? []) }) }),
    insert: () => ({ values: pgValues(async (values: unknown) => { if (failAtInsert) throw new Error("Penyimpanan pembayaran gagal."); inserts.push(values); return [{ insertId: 91 }]; }) }),
  };
  return { tx, inserts };
}

describe("exchange settlement", () => {
  it("records the exact positive adjustment with the selected cash or card method", async () => {
    const state = transactionDouble([
      [{ id: 71, saleId: 51, paymentAdjustment: 8000 }],
      [{ id: 51, status: "partially_refunded" }],
      [],
    ]);
    await expect(settleExchangeInTransaction(state.tx, { exchangeId: 71, paymentMethod: "card" })).resolves.toEqual({ id: 91, exchangeId: 71, amount: 8000, paymentMethod: "card" });
    expect(state.inserts).toEqual([{ exchangeId: 71, amount: 8000, paymentMethod: "card" }]);
  });

  it("rejects settlement when an exchange does not require an additional payment", async () => {
    const state = transactionDouble([[{ id: 71, saleId: 51, paymentAdjustment: 0 }]]);
    await expect(settleExchangeInTransaction(state.tx, { exchangeId: 71, paymentMethod: "cash" })).rejects.toThrow("Penukaran ini tidak memerlukan tambahan pembayaran.");
    expect(state.inserts).toEqual([]);
  });

  it("prevents duplicate settlement records", async () => {
    const state = transactionDouble([
      [{ id: 71, saleId: 51, paymentAdjustment: 8000 }],
      [{ id: 51, status: "completed" }],
      [{ id: 91 }],
    ]);
    await expect(settleExchangeInTransaction(state.tx, { exchangeId: 71, paymentMethod: "cash" })).rejects.toThrow("Pembayaran tambahan penukaran sudah dicatat.");
    expect(state.inserts).toEqual([]);
  });

  it("blocks settlement after the related sale has been voided or fully refunded", async () => {
    const state = transactionDouble([
      [{ id: 71, saleId: 51, paymentAdjustment: 8000 }],
      [{ id: 51, status: "voided" }],
    ]);
    await expect(settleExchangeInTransaction(state.tx, { exchangeId: 71, paymentMethod: "cash" })).rejects.toThrow("Transaksi sudah dibatalkan atau direfund.");
    expect(state.inserts).toEqual([]);
  });

  it("relies on the outer transaction to keep a failed payment write from being committed", async () => {
    const state = { committed: false };
    const tx = transactionDouble([
      [{ id: 71, saleId: 51, paymentAdjustment: 8000 }],
      [{ id: 51, status: "completed" }],
      [],
    ], true).tx;
    const client = { transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => { try { return await callback(tx); } catch (error) { state.committed = false; throw error; } } };
    await expect(settleExchangeWithClient(client, { exchangeId: 71, paymentMethod: "cash" })).rejects.toThrow("Penyimpanan pembayaran gagal.");
    expect(state.committed).toBe(false);
  });
});
