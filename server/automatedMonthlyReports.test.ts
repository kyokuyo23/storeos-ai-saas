import { describe, expect, it, vi } from "vitest";
import {
  getMonthlyHeartbeatDefinition,
  handleAutomatedMonthlyReport,
  monthlyReportToPrintableHtml,
  resolvePreviousCompletedJakartaMonth,
} from "./automatedMonthlyReports";
import { sdk } from "./_core/sdk";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";

const report = {
  period: {
    year: 2026,
    month: 1,
    label: "Januari 2026",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    timezone: "Asia/Jakarta",
  },
  generatedAt: "2026-02-01T00:15:00.000Z",
  auditNotes: [{ reference: "OPN-2026-01-ABC", type: "follow_up", note: "Periksa selisih kopi" }],
  financial: {
    grossSales: 150000,
    netRevenue: 135000,
    cogs: 45000,
    grossProfit: 90000,
    grossMargin: 66.67,
    salesTransactionCount: 3,
    refundValue: 10000,
    voidValue: 5000,
    exchangeImpact: 0,
  },
  inventory: {
    openingStock: 100,
    closingStock: 82,
    expectedStock: 80,
    actualStock: 82,
    totalVariance: 2,
    outOfToleranceItemCount: 1,
    highValueVarianceCount: 1,
    recurringHighVarianceIngredientCount: 1,
    stockOpnameSessionCount: 1,
    openStockOpnameFollowUpCount: 1,
  },
  source: {
    financial: "Financial Core",
    inventory: "Inventory Ledger + Inventory Intelligence",
    auditNotes: "Stock Opname + Follow-up",
    recurringVariancePeriods: ["2026-01-01", "2025-12-01", "2025-11-01"],
  },
} as never;

type MockResponse = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

function response(): MockResponse {
  const result = {} as MockResponse;
  result.status = vi.fn(() => result);
  result.json = vi.fn(() => result);
  return result;
}

describe("Phase 2.2 automated monthly management reporting", () => {
  it("defines a first-of-month 00:15 WIB Heartbeat schedule in UTC", () => {
    expect(getMonthlyHeartbeatDefinition()).toMatchObject({
      cron: "0 15 17 1 * *",
      path: "/api/scheduled/monthly-management-report",
    });
  });

  it("selects the previous completed Jakarta month across a year boundary", () => {
    expect(resolvePreviousCompletedJakartaMonth(new Date("2026-01-01T00:14:59.000Z"))).toEqual({ year: 2025, month: 12 });
    expect(resolvePreviousCompletedJakartaMonth(new Date("2026-02-01T00:15:00.000Z"))).toEqual({ year: 2026, month: 1 });
  });

  it("renders metadata, financial/inventory reconciliation fields, audit notes, and safe empty-state text in printable output", () => {
    const html = monthlyReportToPrintableHtml(report);
    expect(html).toContain("Generated At: 2026-02-01T00:15:00.000Z");
    expect(html).toContain("Periksa selisih kopi");
    expect(html).toContain("Net Revenue");
    expect(html).toContain("135000");
    expect(html).toContain("Recurring High Variance Ingredient Count");
    const empty = { ...report, auditNotes: [] } as never;
    const emptyHtml = monthlyReportToPrintableHtml(empty);
    expect(emptyHtml).toContain("Tidak ada catatan audit pada periode ini.");

    const nonEmptyPdf = printableMonthlyHtmlToPdf(html).toString("latin1");
    const emptyPdf = printableMonthlyHtmlToPdf(emptyHtml).toString("latin1");
    expect(nonEmptyPdf).toContain("%PDF-");
    expect(nonEmptyPdf).toContain("Januari 2026");
    expect(nonEmptyPdf).toContain("Generated At: 2026-02-01T00:15:00.000Z");
    expect(nonEmptyPdf).toContain("Periksa selisih kopi");
    expect(emptyPdf).toContain("Tidak ada catatan audit pada periode ini.");
  });

  it("rejects non-cron callers without running report generation", async () => {
    const auth = vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = response();
    await handleAutomatedMonthlyReport({ originalUrl: "/api/scheduled/monthly-management-report" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
    auth.mockRestore();
  });

  it("returns a JSON 500 with retry-safe diagnostics when authentication fails", async () => {
    const auth = vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(new Error("temporary auth failure"));
    const res = response();
    await handleAutomatedMonthlyReport({ originalUrl: "/api/scheduled/monthly-management-report" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "temporary auth failure", context: { url: "/api/scheduled/monthly-management-report" } }));
    auth.mockRestore();
  });
});
