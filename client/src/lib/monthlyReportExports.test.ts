// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMonthlyReportCsv,
  downloadMonthlyReportCsv,
  monthlyReportCsvFilename,
  printMonthlyReport,
  type MonthlyReportExportData,
} from "./monthlyReportExports";

const report: MonthlyReportExportData = {
  period: {
    label: "Januari 2026",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    timezone: "Asia/Jakarta",
    year: 2026,
    month: 1,
  },
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
    stockOpnameSessionCount: 2,
    openStockOpnameFollowUpCount: 1,
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("monthly report browser exports", () => {
  it("builds a UTF-8 CSV with the selected Jakarta month and all report sections", async () => {
    const csv = buildMonthlyReportCsv(report);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"StoreOS Monthly Management Report","Januari 2026"');
    expect(csv).toContain('"Periode mulai","2026-01-01"');
    expect(csv).toContain('"Periode akhir","2026-01-31"');
    expect(csv).toContain('"Timezone","Asia/Jakarta"');
    expect(csv).toContain('"Gross Sales","150000"');
    expect(csv).toContain('"Recurring High Variance Ingredient Count","1"');
    expect(csv).not.toContain("2025-12-31");
    expect(csv.endsWith("\r\n")).toBe(true);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    expect(await blob.text()).toBe(csv);
  });

  it("uses an exact year-month filename and triggers a browser download", () => {
    expect(monthlyReportCsvFilename(report)).toBe("storeos-monthly-2026-01.csv");

    const createObjectURL = vi.fn(() => "blob:storeos-monthly");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const anchor = document.createElement("a");
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const click = vi.spyOn(anchor, "click").mockImplementation(() => undefined);

    downloadMonthlyReportCsv(report);

    expect(createElement).toHaveBeenCalledWith("a");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchor.href).toBe("blob:storeos-monthly");
    expect(anchor.download).toBe("storeos-monthly-2026-01.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:storeos-monthly");
  });

  it("invokes the browser print pipeline for PDF output only when a report exists", () => {
    const print = vi.fn();
    vi.stubGlobal("window", { print });

    printMonthlyReport(report);
    printMonthlyReport(undefined);

    expect(print).toHaveBeenCalledOnce();
  });
});
