import { describe, expect, it } from "vitest";
import { summarizeInventoryIntelligence, type InventoryIntelligenceMovement } from "./inventoryIntelligence";

const range = { start: new Date("2026-08-10T00:00:00.000Z"), end: new Date("2026-08-11T00:00:00.000Z") };
const ingredient = { id: 1, name: "Biji Kopi", unit: "gram", costPerUnit: 3 };
const movement = (type: InventoryIntelligenceMovement["type"], quantityDelta: number, balanceAfter: number, occurredAt: string): InventoryIntelligenceMovement => ({ ingredientId: 1, type, quantityDelta, balanceAfter, occurredAt: new Date(occurredAt) });

describe("summarizeInventoryIntelligence", () => {
  it("menghitung stok awal dari seluruh catatan sebelum periode dan stok ekspektasi dari pembelian serta konsumsi resep", () => {
    const report = summarizeInventoryIntelligence([ingredient], [
      movement("purchase", 10, 10, "2026-08-09T09:00:00.000Z"),
      movement("sale", -2, 8, "2026-08-09T10:00:00.000Z"),
      movement("purchase", 5, 13, "2026-08-10T09:00:00.000Z"),
      movement("sale", -3, 10, "2026-08-10T12:00:00.000Z"),
    ], range);

    expect(report.rows[0]).toMatchObject({ openingStock: 8, purchases: 5, theoreticalConsumption: 3, expectedClosingStock: 10, actualClosingStock: 10, variance: 0, varianceValue: 0, status: "ok" });
  });

  it("menetapkan konsumsi teoritis bersih setelah refund, void, dan kedua sisi penukaran", () => {
    const report = summarizeInventoryIntelligence([ingredient], [
      movement("purchase", 20, 20, "2026-08-09T09:00:00.000Z"),
      movement("sale", -10, 10, "2026-08-10T09:00:00.000Z"),
      movement("refund", 10, 20, "2026-08-10T09:10:00.000Z"),
      movement("sale", -5, 15, "2026-08-10T10:00:00.000Z"),
      movement("exchange_return", 2, 17, "2026-08-10T10:10:00.000Z"),
      movement("exchange_sale", -3, 14, "2026-08-10T10:11:00.000Z"),
    ], range);

    expect(report.rows[0]).toMatchObject({ theoreticalConsumption: 6, expectedClosingStock: 14, actualClosingStock: 14, variance: 0, status: "ok" });
  });

  it("memisahkan waste dan penyesuaian manual sebagai varians operasional dengan nilai rupiah", () => {
    const report = summarizeInventoryIntelligence([ingredient], [
      movement("purchase", 10, 10, "2026-08-09T09:00:00.000Z"),
      movement("sale", -4, 6, "2026-08-10T09:00:00.000Z"),
      movement("waste", -1, 5, "2026-08-10T10:00:00.000Z"),
      movement("adjustment", 2, 7, "2026-08-10T11:00:00.000Z"),
    ], range);

    expect(report.rows[0]).toMatchObject({ theoreticalConsumption: 4, expectedClosingStock: 6, actualClosingStock: 7, variance: 1, varianceValue: 3, adjustmentQuantity: 2, wasteQuantity: -1, status: "over" });
  });

  it("menggunakan saldo opname terakhir pada periode sebagai stok aktual dan menandai kekurangan", () => {
    const report = summarizeInventoryIntelligence([ingredient], [
      movement("purchase", 10, 10, "2026-08-09T09:00:00.000Z"),
      movement("sale", -2, 8, "2026-08-10T09:00:00.000Z"),
      movement("opname", -1, 7, "2026-08-10T14:00:00.000Z"),
    ], range);

    expect(report.rows[0]).toMatchObject({ expectedClosingStock: 8, actualClosingStock: 7, variance: -1, varianceValue: -3, opnameQuantity: -1, status: "under" });
  });
});
