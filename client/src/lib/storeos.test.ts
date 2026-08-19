import { describe, expect, it } from "vitest";
import { answerStoreQuestion, applyCompletedSale, calculateSavings, createDemoData, getAlerts, getInventoryVariance, getStoreHealth } from "./storeos";

describe("StoreOS deterministic operating calculations", () => {
  it("calculates savings from seeded stock movement and operational data", () => {
    const savings = calculateSavings(createDemoData());
    expect(savings.waste).toBe(240000);
    expect(savings.total).toBeGreaterThan(savings.waste);
  });

  it("finds a critical theoretical-versus-actual variance from shared application data", () => {
    const variance = getInventoryVariance(createDemoData());
    expect(variance.find((item) => item.id === "milk")?.status).toBe("Kritis");
  });

  it("creates data-backed operational alerts and health scores", () => {
    const data = createDemoData();
    expect(getAlerts(data).some((alert) => alert.category === "Stok")).toBe(true);
    expect(getStoreHealth(data).score).toBeGreaterThan(0);
  });

  it("answers a sales question using current data rather than a static response", () => {
    const answer = answerStoreQuestion(createDemoData(), "Produk paling untung apa?");
    expect(answer).toContain("gross profit tertinggi");
  });

  it("writes a completed POS sale to sales, stock movements, inventory, and daily KPIs together", () => {
    const data = createDemoData();
    const product = data.products.find((item) => item.id === "es-kopi-susu");
    if (!product) throw new Error("Seeded coffee product is required for the test");
    const result = applyCompletedSale(data, [{ product, quantity: 2, discount: 1000 }], "QRIS", "TRX-TEST", "2026-08-19T10:00:00.000Z");
    expect(result.data.transactions[0]?.id).toBe("TRX-TEST");
    expect(result.data.products.find((item) => item.id === product.id)?.stock).toBe(product.stock - 2);
    expect(result.data.ingredients.find((item) => item.id === "milk")?.currentStock).toBeCloseTo(34.76, 2);
    expect(result.data.movements.some((movement) => movement.note === "POS TRX-TEST")).toBe(true);
    expect(result.data.dailyMetrics.at(-1)?.transactions).toBe(data.dailyMetrics.at(-1)!.transactions + 1);
  });
});
