import { describe, expect, it } from "vitest";
import { buildStoreAlerts } from "./storeAlerts";
import { buildStoreInsights, percentChange } from "./storeInsights";
import { jakartaDate, rollingJakartaPeriods } from "./storeOperations";

const ingredient = (id: number, name: string, currentStock: number, minimumStock = 0, isActive = true) => ({ id, name, unit: "gram", currentStock, minimumStock, isActive });
const thresholds = { opnameWarningAgeDays: 3, opnameCriticalAgeDays: 7 };

describe("store alerts", () => {
  it("flags out-of-stock as critical and low stock as warning, ignoring inactive ingredients", () => {
    const { alerts, counts } = buildStoreAlerts({
      ingredients: [ingredient(1, "Kopi", 0, 100), ingredient(2, "Susu", 50, 100), ingredient(3, "Gula", 500, 100), ingredient(4, "Lama", 0, 10, false)],
      products: [], recipes: [], opname: null, variance: [], thresholds,
    });
    expect(alerts.map((alert) => [alert.id, alert.severity])).toEqual([["stock-out-1", "critical"], ["stock-low-2", "warning"]]);
    expect(counts).toEqual({ critical: 1, warning: 1, info: 0 });
  });

  it("explains why an active product cannot be sold: no recipe, insufficient or inactive ingredient", () => {
    const { alerts } = buildStoreAlerts({
      ingredients: [ingredient(1, "Kopi", 10), ingredient(2, "Susu", 500), ingredient(3, "Sirup", 100, 0, false)],
      products: [{ id: 10, name: "Latte", isActive: true }, { id: 11, name: "Americano", isActive: true }, { id: 12, name: "Es Sirup", isActive: true }, { id: 13, name: "Teh", isActive: true }, { id: 14, name: "Lama", isActive: false }],
      recipes: [
        { productId: 10, items: [{ ingredientId: 1, quantity: 18 }, { ingredientId: 2, quantity: 120 }] },
        { productId: 11, items: [{ ingredientId: 1, quantity: 8 }] },
        { productId: 12, items: [{ ingredientId: 3, quantity: 20 }] },
      ],
      opname: null, variance: [], thresholds,
    });
    const byId = Object.fromEntries(alerts.map((alert) => [alert.id, alert]));
    expect(byId["menu-blocked-10"].severity).toBe("critical");
    expect(byId["menu-blocked-10"].detail).toContain("Kopi kurang (butuh 18 gram, ada 10)");
    expect(byId["menu-blocked-11"]).toBeUndefined();
    expect(byId["menu-blocked-12"].detail).toContain("Sirup nonaktif");
    expect(byId["menu-no-recipe-13"].severity).toBe("warning");
    expect(alerts.some((alert) => alert.id.endsWith("-14"))).toBe(false);
  });

  it("grades open opname follow-ups by age and reports out-of-tolerance variance", () => {
    const run = (age: number) => buildStoreAlerts({ ingredients: [], products: [], recipes: [], opname: { openSessionCount: 2, needsFollowUpCount: 1, oldestOpenSessionReference: "OPN-1", oldestOpenSessionAgeDays: age }, variance: [], thresholds }).alerts[0].severity;
    expect([run(1), run(3), run(7)]).toEqual(["info", "warning", "critical"]);
    const { alerts } = buildStoreAlerts({ ingredients: [], products: [], recipes: [], opname: { openSessionCount: 0, needsFollowUpCount: 0, oldestOpenSessionReference: null, oldestOpenSessionAgeDays: null }, variance: [
      { ingredientId: 1, ingredientName: "Kopi", unit: "gram", status: "under", variance: -12.5 },
      { ingredientId: 2, ingredientName: "Susu", unit: "ml", status: "ok", variance: 0 },
    ], thresholds });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].detail).toContain("kurang 12,5 gram");
  });
});

const totals = (overrides: Partial<Parameters<typeof buildStoreInsights>[0]["current"]> = {}) => ({ revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, saleCount: 0, unitsSold: 0, refundValue: 0, voidValue: 0, exchangeImpact: 0, productPerformance: [], ...overrides });

describe("store insights", () => {
  it("returns a neutral empty-state finding and no fake numbers when there are no sales", () => {
    const insights = buildStoreInsights({ days: 30, current: totals(), previous: totals(), products: [{ id: 1, name: "Latte", isActive: true }], ingredients: [], consumption: new Map() });
    expect(insights.findings.map((finding) => finding.id)).toEqual(["no-sales"]);
    expect(insights.kpis.revenueChange).toBeNull();
    expect(insights.kpis.averageTicket).toBe(0);
  });

  it("compares periods, ranks products, flags low margin, unsold products and short stock coverage", () => {
    const current = totals({
      revenue: 120000, cogs: 60000, grossProfit: 60000, grossMargin: 50, saleCount: 4, unitsSold: 6,
      productPerformance: [
        { productId: 1, productName: "Latte", quantity: 4, revenue: 80000, cogs: 30000, grossProfit: 50000, grossMargin: 62.5 },
        { productId: 2, productName: "Mocha", quantity: 2, revenue: 40000, cogs: 30000, grossProfit: 10000, grossMargin: 25 },
      ],
    });
    const previous = totals({ revenue: 100000, grossMargin: 45, saleCount: 3 });
    const insights = buildStoreInsights({
      days: 30, current, previous,
      products: [{ id: 1, name: "Latte", isActive: true }, { id: 2, name: "Mocha", isActive: true }, { id: 3, name: "Teh", isActive: true }],
      ingredients: [{ id: 1, name: "Kopi", unit: "gram", currentStock: 90, isActive: true }, { id: 2, name: "Susu", unit: "ml", currentStock: 1000, isActive: true }],
      consumption: new Map([[1, 600], [2, 0]]),
    });
    expect(insights.kpis).toMatchObject({ revenueChange: 20, marginChangePoints: 5, averageTicket: 30000 });
    expect(insights.topProducts.map((product) => product.productName)).toEqual(["Latte", "Mocha"]);
    expect(insights.lowMarginProducts.map((product) => product.productName)).toEqual(["Mocha"]);
    expect(insights.unsoldProducts).toEqual([{ productId: 3, productName: "Teh" }]);
    expect(insights.stockCoverage[0]).toMatchObject({ name: "Kopi", avgDailyUse: 20, coverageDays: 4.5 });
    expect(insights.stockCoverage[1].coverageDays).toBeNull();
    expect(insights.findings.map((finding) => finding.id)).toEqual(["revenue-trend", "margin-trend", "top-product", "low-margin", "unsold", "short-coverage"]);
    expect(insights.findings[0]).toMatchObject({ tone: "positive", title: "Pendapatan naik 20%" });
  });

  it("percentChange has no base when the previous value is zero", () => {
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(50, 100)).toBe(-50);
  });
});

describe("rolling Jakarta periods", () => {
  it("uses Jakarta calendar days, including the UTC evening rollover", () => {
    const now = new Date("2026-10-12T17:30:00Z"); // 2026-10-13 00:30 WIB
    expect(jakartaDate(now)).toBe("2026-10-13");
    expect(rollingJakartaPeriods(now, 30)).toEqual({
      current: { startDate: "2026-09-14", endDate: "2026-10-13" },
      previous: { startDate: "2026-08-15", endDate: "2026-09-13" },
    });
  });
});
