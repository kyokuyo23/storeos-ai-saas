import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeFinancialSales, type FinancialSale } from "./financials";
import { summarizeInventoryIntelligence, type InventoryIntelligenceMovement } from "./inventoryIntelligence";
import { applyStockOpnameFollowUpStatuses, summarizeStockOpnameSessions, type StockOpnameHistoryMovement } from "./opnameHistory";
import { resolveJakartaMonth, getMonthlyManagementReport } from "./monthlyReports";

const fixtureState = vi.hoisted(() => ({
  sales: [] as FinancialSale[],
  inventoryReports: new Map<string, ReturnType<typeof summarizeInventoryIntelligence>>(),
  opnameRows: [] as StockOpnameHistoryMovement[],
  followUps: [] as Array<{ auditReference: string; status: "needs_follow_up" | "in_progress" | "resolved"; followUpNote?: string | null }>,
}));

vi.mock("./db", () => ({
  getFinancialDashboard: vi.fn(async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
    const start = new Date(`${startDate}T00:00:00+07:00`);
    const end = new Date(new Date(`${endDate}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
    const sales = fixtureState.sales.filter((sale) => sale.completedAt >= start && sale.completedAt < end);
    return { ...summarizeFinancialSales(sales), dateStart: start, dateEnd: end, startDate, endDate };
  }),
  getInventoryIntelligence: vi.fn(async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
    const report = fixtureState.inventoryReports.get(startDate) ?? fixtureState.inventoryReports.get("2026-01-01");
    if (!report) throw new Error(`Missing inventory fixture for ${startDate}–${endDate}`);
    return { ...report, dateStart: new Date(`${startDate}T00:00:00+07:00`), dateEnd: new Date(`${endDate}T00:00:00+07:00`), startDate, endDate };
  }),
  listStockOpnameSessions: vi.fn(async () => applyStockOpnameFollowUpStatuses(summarizeStockOpnameSessions(fixtureState.opnameRows), fixtureState.followUps)),
}));

const jakarta = (value: string) => new Date(value);
const ingredientRows = [
  { id: 1, name: "Biji kopi", unit: "kg", costPerUnit: 10, overrideAbsoluteTolerance: null, overridePercentageTolerance: null },
  { id: 2, name: "Susu", unit: "liter", costPerUnit: 4, overrideAbsoluteTolerance: 0.25, overridePercentageTolerance: null },
];

const movements: InventoryIntelligenceMovement[] = [
  { ingredientId: 1, type: "purchase", quantityDelta: 10, balanceAfter: 10, occurredAt: jakarta("2025-12-31T16:59:00.000Z") },
  { ingredientId: 1, type: "waste", quantityDelta: -1, balanceAfter: 9, occurredAt: jakarta("2026-12-20T03:00:00.000Z") },
  { ingredientId: 1, type: "sale", quantityDelta: -2, balanceAfter: 7, occurredAt: jakarta("2026-01-05T03:00:00.000Z") },
  { ingredientId: 1, type: "partial_refund", quantityDelta: 1, balanceAfter: 8, occurredAt: jakarta("2026-01-10T03:00:00.000Z") },
  { ingredientId: 1, type: "exchange_return", quantityDelta: 1, balanceAfter: 9, occurredAt: jakarta("2026-01-10T03:01:00.000Z") },
  { ingredientId: 1, type: "waste", quantityDelta: -1, balanceAfter: 8, occurredAt: jakarta("2026-01-25T03:00:00.000Z") },
  { ingredientId: 1, type: "opname", quantityDelta: -1, balanceAfter: 7, occurredAt: jakarta("2026-01-31T16:00:00.000Z") },
  { ingredientId: 2, type: "purchase", quantityDelta: 5, balanceAfter: 5, occurredAt: jakarta("2025-12-31T16:59:00.000Z") },
  { ingredientId: 2, type: "sale", quantityDelta: -1, balanceAfter: 4, occurredAt: jakarta("2026-01-05T03:00:00.000Z") },
];

const financialSales: FinancialSale[] = [
  {
    id: 1,
    status: "completed",
    completedAt: jakarta("2026-01-05T03:00:00.000Z"),
    lines: [
      { id: 11, productId: 101, productName: "Kopi susu", quantity: 2, unitPrice: 50, lineTotal: 100, refundedQuantity: 0, exchanges: [], ingredientSnapshots: [{ ingredientId: 1, unitQuantity: 1, unitCost: 10 }] },
      { id: 12, productId: 102, productName: "Teh susu", quantity: 1, unitPrice: 30, lineTotal: 30, refundedQuantity: 0, exchanges: [], ingredientSnapshots: [{ ingredientId: 2, unitQuantity: 1, unitCost: 4 }] },
    ],
  },
  {
    id: 2,
    status: "partially_refunded",
    completedAt: jakarta("2026-01-10T03:00:00.000Z"),
    lines: [{
      id: 21,
      productId: 101,
      productName: "Kopi susu",
      quantity: 3,
      unitPrice: 50,
      lineTotal: 150,
      refundedQuantity: 1,
      exchanges: [{ id: 201, saleItemId: 21, returnedQuantity: 1, returnedTotal: 50, replacementTotal: 30, items: [{ productId: 102, productName: "Teh susu", quantity: 1, lineTotal: 30, ingredientSnapshots: [{ ingredientId: 2, unitQuantity: 1, unitCost: 4 }] }] }],
      ingredientSnapshots: [{ ingredientId: 1, unitQuantity: 1, unitCost: 10 }],
    }],
  },
  {
    id: 3,
    status: "voided",
    completedAt: jakarta("2026-01-15T03:00:00.000Z"),
    lines: [{ id: 31, productId: 101, productName: "Kopi susu", quantity: 1, unitPrice: 40, lineTotal: 40, refundedQuantity: 0, exchanges: [], ingredientSnapshots: [{ ingredientId: 1, unitQuantity: 1, unitCost: 10 }] }],
  },
  {
    id: 4,
    status: "refunded",
    completedAt: jakarta("2026-01-20T03:00:00.000Z"),
    lines: [{ id: 41, productId: 101, productName: "Kopi susu", quantity: 1, unitPrice: 60, lineTotal: 60, refundedQuantity: 0, exchanges: [], ingredientSnapshots: [{ ingredientId: 1, unitQuantity: 1, unitCost: 10 }] }],
  },
];

beforeEach(() => {
  fixtureState.sales = [...financialSales];
  fixtureState.inventoryReports.clear();
  const currentInventory = summarizeInventoryIntelligence(ingredientRows, movements, resolveJakartaMonth(2026, 1), { absoluteQuantity: 0.5, percentage: 0 });
  for (const target of [{ year: 2026, month: 1 }, { year: 2025, month: 12 }, { year: 2025, month: 11 }]) {
    const period = resolveJakartaMonth(target.year, target.month);
    fixtureState.inventoryReports.set(period.startDate, currentInventory);
  }
  fixtureState.opnameRows = [{ id: 9001, ingredientId: 1, ingredientName: "Biji kopi", unit: "kg", quantityDelta: -1, balanceAfter: 7, note: "Stock opname fisik OPN-1769875200000-ABC12 · Januari closing", occurredAt: jakarta("2026-01-31T16:00:00.000Z") }];
  fixtureState.followUps = [{ auditReference: "OPN-1769875200000-ABC12", status: "in_progress", followUpNote: "Periksa waste akhir bulan" }];
});

describe("Phase 2.1 non-empty monthly report integration fixtures", () => {
  it("reconciles persisted-shaped sales with Financial Core, including recipe COGS and reversal workflows", async () => {
    const report = await getMonthlyManagementReport({ year: 2026, month: 1 });
    const expected = summarizeFinancialSales(financialSales);
    expect(report.financial.grossSales).toBe(expected.revenue);
    expect(report.financial.netRevenue).toBe(expected.revenue);
    expect(report.financial.cogs).toBe(expected.cogs);
    expect(report.financial.grossProfit).toBe(expected.grossProfit);
    expect(report.financial.grossMargin).toBe(expected.grossMargin);
    expect(report.financial.salesTransactionCount).toBe(expected.saleCount);
    expect(report.financial.refundValue).toBe(110);
    expect(report.financial.voidValue).toBe(40);
    expect(report.financial.exchangeImpact).toBe(-20);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(report.auditNotes).toEqual([
      { reference: "OPN-1769875200000-ABC12", type: "session", note: "Januari closing" },
      { reference: "OPN-1769875200000-ABC12", type: "follow_up", note: "Periksa waste akhir bulan" },
    ]);
    expect(expected.revenue).toBe(210);
    expect(expected.cogs).toBe(38);
    expect(expected.grossProfit).toBe(172);
    expect(expected.grossMargin).toBe(81.9);
  });

  it("reconciles opening, expected, actual, variance, tolerance, high-value, and recurring inventory metrics", async () => {
    const report = await getMonthlyManagementReport({ year: 2026, month: 1 });
    expect(report.inventory.openingStock).toBe(15);
    expect(report.inventory.expectedStock).toBe(14);
    expect(report.inventory.closingStock).toBe(11);
    expect(report.inventory.actualStock).toBe(11);
    expect(report.inventory.totalVariance).toBe(-3);
    expect(report.inventory.outOfToleranceItemCount).toBe(1);
    expect(report.inventory.highValueVarianceCount).toBe(1);
    expect(report.inventory.recurringHighVarianceIngredientCount).toBe(1);
    expect(report.source.recurringVariancePeriods).toEqual(["2026-01-01", "2025-12-01", "2025-11-01"]);
  });

  it("counts a Jakarta/WIB stock-opname session and its open follow-up in the selected month", async () => {
    const report = await getMonthlyManagementReport({ year: 2026, month: 1 });
    expect(report.inventory.stockOpnameSessionCount).toBe(1);
    expect(report.inventory.openStockOpnameFollowUpCount).toBe(1);
    const csv = (await import("./monthlyReports")).monthlyReportToCsv(report);
    expect(csv).toContain('"Generated At","');
    expect(csv).toContain('"Audit Notes","Catatan"');
    expect(csv).toContain('"","OPN-1769875200000-ABC12 · follow_up: Periksa waste akhir bulan"');
  });

  it("keeps month boundaries isolated at Jakarta midnight and handles December rollover", async () => {
    const december = resolveJakartaMonth(2026, 12);
    const january = resolveJakartaMonth(2027, 1);
    expect(december.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(january.start.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(january.start.getTime()).toBe(december.end.getTime());
  });

  it("does not mutate persisted-shaped fixtures while building the report", async () => {
    const beforeSales = JSON.stringify(fixtureState.sales);
    const beforeMovements = JSON.stringify(movements);
    const beforeOpname = JSON.stringify(fixtureState.opnameRows);
    await getMonthlyManagementReport({ year: 2026, month: 1 });
    expect(JSON.stringify(fixtureState.sales)).toBe(beforeSales);
    expect(JSON.stringify(movements)).toBe(beforeMovements);
    expect(JSON.stringify(fixtureState.opnameRows)).toBe(beforeOpname);
  });
});

export {};

// Keep the imported helper in the test module's type graph; the fixture intentionally models persisted rows.
void summarizeStockOpnameSessions;
