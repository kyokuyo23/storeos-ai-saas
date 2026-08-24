import { beforeEach, describe, expect, it, vi } from "vitest";

const { storagePut, storageGet, rows, db } = vi.hoisted(() => {
  const storagePut = vi.fn(async (key: string) => ({ key: `${key}-stored`, url: `/manus-storage/${key}-stored` }));
  const storageGet = vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
  const rows: any[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => rows.slice(0, 1) }),
      }),
    }),
    insert: () => ({
      values: async (value: any) => {
        rows.push({ id: rows.length + 1, ...value, createdAt: new Date("2026-02-01T00:15:00.000Z") });
        return [{ insertId: rows.length }];
      },
    }),
  };
  return { storagePut, storageGet, rows, db };
});
vi.mock("./storage", () => ({ storagePut, storageGet }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => db) }));

import { getMonthlyReportArtifact, getMonthlyReportArtifactDownloadUrls, persistMonthlyReportArtifacts } from "./monthlyReportArtifacts";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";

function generatedReport() {
  return {
    report: {
      period: { year: 2026, month: 1, label: "Januari 2026", startDate: "2026-01-01", endDate: "2026-01-31", timezone: "Asia/Jakarta" },
      generatedAt: "2026-02-01T00:15:00.000Z",
      auditNotes: [{ reference: "OPN-01", type: "follow_up", note: "Periksa selisih" }],
      financial: { grossSales: 0, netRevenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, salesTransactionCount: 0, refundValue: 0, voidValue: 0, exchangeImpact: 0 },
      inventory: { openingStock: 0, closingStock: 0, expectedStock: 0, actualStock: 0, totalVariance: 0, outOfToleranceItemCount: 0, highValueVarianceCount: 0, recurringHighVarianceIngredientCount: 0, stockOpnameSessionCount: 0, openStockOpnameFollowUpCount: 0 },
      source: { financial: "Financial Core", inventory: "Inventory Intelligence", auditNotes: "Stock Opname + Follow-up", recurringVariancePeriods: [] },
    },
    csv: "\ufeff\"Periode mulai\",\"2026-01-01\"\n\"Audit Notes\",\"Periksa selisih\"\n",
    printableHtml: "<!doctype html><html><body>Januari 2026 · Generated At: 2026-02-01T00:15:00.000Z · Periksa selisih</body></html>",
    pdf: printableMonthlyHtmlToPdf("<!doctype html><html><body>Januari 2026 · Generated At: 2026-02-01T00:15:00.000Z · Periksa selisih</body></html>"),
    generatedAt: "2026-02-01T00:15:00.000Z",
  } as any;
}

describe("Phase 2.2 durable monthly report artifacts", () => {
  beforeEach(() => {
    rows.length = 0;
    storagePut.mockClear();
    storageGet.mockClear();
  });

  it("creates durable CSV, printable HTML, and real PDF metadata for an empty Jakarta month", async () => {
    const result = await persistMonthlyReportArtifacts(generatedReport());
    expect(result.created).toBe(true);
    expect(result.artifact).toMatchObject({ year: 2026, month: 1, timezone: "Asia/Jakarta", periodStartDate: "2026-01-01", periodEndDate: "2026-01-31", generatedAt: new Date("2026-02-01T00:15:00.000Z") });
    expect(result.artifact.csv.bytes).toBeGreaterThan(0);
    expect(result.artifact.printableHtml.bytes).toBeGreaterThan(0);
    expect(result.artifact.pdf.bytes).toBeGreaterThan(0);
    expect(result.artifact.csv.sha256).toHaveLength(64);
    expect(result.artifact.printableHtml.sha256).toHaveLength(64);
    expect(result.artifact.pdf.sha256).toHaveLength(64);
    expect(storagePut).toHaveBeenCalledTimes(3);
  });

  it("retrieves one deterministic artifact by year and month with storage URLs", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    const artifact = await getMonthlyReportArtifact(2026, 1);
    const downloadable = await getMonthlyReportArtifactDownloadUrls(2026, 1);
    expect(artifact?.year).toBe(2026);
    expect(artifact?.month).toBe(1);
    expect(downloadable?.csv.url).toBe("/manus-storage/monthly-management-reports/2026/01/report.csv-stored");
    expect(downloadable?.printableHtml.url).toBe("/manus-storage/monthly-management-reports/2026/01/report.html-stored");
    expect(downloadable?.pdf.url).toBe("/manus-storage/monthly-management-reports/2026/01/report.pdf-stored");
    expect(storageGet).toHaveBeenCalledTimes(3);
  });

  it("does not overwrite a previously stored period on duplicate generation", async () => {
    const first = await persistMonthlyReportArtifacts(generatedReport());
    const second = await persistMonthlyReportArtifacts({ ...generatedReport(), csv: "different", printableHtml: "different", generatedAt: "2026-02-01T02:00:00.000Z" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.artifact.csv.sha256).toBe(first.artifact.csv.sha256);
    expect(second.artifact.pdf.sha256).toBe(first.artifact.pdf.sha256);
    expect(storagePut).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(1);
  });

  it("keeps artifact identity tied to the Jakarta calendar period and generated timestamp", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    expect(rows[0]).toMatchObject({ year: 2026, month: 1, timezone: "Asia/Jakarta", generatedAt: new Date("2026-02-01T00:15:00.000Z") });
  });

  it("does not expose mutation operations for transaction or inventory records", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    expect(db).not.toHaveProperty("update");
    expect(db).not.toHaveProperty("delete");
    expect(rows[0]).not.toHaveProperty("saleId");
    expect(rows[0]).not.toHaveProperty("ingredientId");
  });

  it("generates a valid PDF containing Jakarta period, timestamp, and audit-note report content", () => {
    const pdf = printableMonthlyHtmlToPdf(generatedReport().printableHtml);
    const text = pdf.toString("latin1");
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(text).toContain("Januari 2026");
    expect(text).toContain("Generated At: 2026-02-01T00:15:00.000Z");
    expect(text).toContain("Periksa selisih");
    expect(text).toContain("%%EOF");
  });
});
