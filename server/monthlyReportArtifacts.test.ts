import { beforeEach, describe, expect, it, vi } from "vitest";

const { storagePut, storageGetBytes, rows, objects, db, updateWhere } = vi.hoisted(() => {
  const rows: any[] = [];
  const objects = new Map<string, Buffer>();
  const storagePut = vi.fn(async (key: string, data: string | Buffer) => {
    const storedKey = `${key}-stored`;
    objects.set(storedKey, Buffer.isBuffer(data) ? data : Buffer.from(data));
    return { key: storedKey, url: `/manus-storage/${storedKey}` };
  });
  const storageGetBytes = vi.fn(async (key: string) => {
    const data = objects.get(key);
    if (!data) {
      const error = new Error("Stored artifact was not found") as Error & { code?: string };
      error.code = "STORAGE_NOT_FOUND";
      throw error;
    }
    return { key, data, contentType: null };
  });
  const selectRows = () => {
    const selection = rows.slice() as any;
    selection.limit = async (count: number) => rows.slice(0, count);
    return selection;
  };
  const updateWhere = vi.fn(async () => ({ affectedRows: 1 }));
  const db = {
    select: () => ({ from: () => ({ where: () => selectRows() }) }),
    insert: () => ({
      values: async (value: any) => {
        rows.push({ id: rows.length + 1, ...value, retiredAt: null, createdAt: new Date("2026-02-01T00:15:00.000Z") });
        return [{ insertId: rows.length }];
      },
    }),
    update: () => ({ set: () => ({ where: updateWhere }) }),
  };
  return { storagePut, storageGetBytes, rows, objects, db, updateWhere };
});
vi.mock("./storage", () => ({ storagePut, storageGetBytes }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => db) }));
vi.mock("./_core/env", () => ({ ENV: { ownerOpenId: "owner-1" } }));

import {
  canAccessMonthlyReportArtifacts,
  getMonthlyReportArtifact,
  listMonthlyReportArtifacts,
  persistMonthlyReportArtifacts,
  readVerifiedMonthlyReportArtifact,
  retireExpiredMonthlyReportArtifacts,
  retentionCutoff,
  verifyMonthlyReportArtifact,
} from "./monthlyReportArtifacts";
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

describe("Phase 2.3 managed monthly report artifacts", () => {
  beforeEach(() => {
    rows.length = 0;
    objects.clear();
    storagePut.mockClear();
    storageGetBytes.mockClear();
    updateWhere.mockClear();
  });

  it("creates scoped CSV, HTML, and PDF metadata for an empty Jakarta month without mutating transactional data", async () => {
    const result = await persistMonthlyReportArtifacts(generatedReport());
    expect(result.created).toBe(true);
    expect(result.artifact).toMatchObject({ ownerOpenId: "owner-1", year: 2026, month: 1, timezone: "Asia/Jakarta", periodStartDate: "2026-01-01", periodEndDate: "2026-01-31", generatedAt: new Date("2026-02-01T00:15:00.000Z") });
    expect(result.artifact.csv.bytes).toBeGreaterThan(0);
    expect(result.artifact.printableHtml.bytes).toBeGreaterThan(0);
    expect(result.artifact.pdf.bytes).toBeGreaterThan(0);
    expect(result.artifact.csv.sha256).toHaveLength(64);
    expect(storagePut).toHaveBeenCalledTimes(3);
    expect(rows[0]).not.toHaveProperty("saleId");
    expect(rows[0]).not.toHaveProperty("ingredientId");
  });

  it("lists deterministic period metadata with server-verified integrity and no raw storage paths", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    const list = await listMonthlyReportArtifacts("owner-1", { year: 2026 });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ year: 2026, month: 1, csv: { status: "available" }, printableHtml: { status: "available" }, pdf: { status: "available" } });
    expect(list[0]).not.toHaveProperty("csv.key");
    expect(storageGetBytes).toHaveBeenCalledTimes(3);
  });

  it("returns only verified bytes for a controlled download read", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    const result = await readVerifiedMonthlyReportArtifact(2026, 1, "csv", "owner-1");
    expect(result?.availability.status).toBe("available");
    expect(result?.data?.toString("utf8")).toContain("Periksa selisih");
    expect(result?.data?.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it("fails safely as missing when a stored object is absent", async () => {
    const persisted = await persistMonthlyReportArtifacts(generatedReport());
    objects.delete(persisted.artifact.pdf.key);
    const availability = await verifyMonthlyReportArtifact(persisted.artifact, "pdf");
    const result = await readVerifiedMonthlyReportArtifact(2026, 1, "pdf", "owner-1");
    expect(availability.status).toBe("missing");
    expect(result?.data).toBeNull();
    expect(result?.availability.status).toBe("missing");
  });

  it("fails safely as corrupt when bytes no longer match the persisted SHA-256", async () => {
    const persisted = await persistMonthlyReportArtifacts(generatedReport());
    objects.set(persisted.artifact.csv.key, Buffer.from("tampered"));
    const availability = await verifyMonthlyReportArtifact(persisted.artifact, "csv");
    expect(availability.status).toBe("corrupt");
  });

  it("does not overwrite a previously stored period on duplicate generation", async () => {
    const first = await persistMonthlyReportArtifacts(generatedReport());
    const second = await persistMonthlyReportArtifacts({ ...generatedReport(), csv: "different", printableHtml: "different", generatedAt: "2026-02-01T02:00:00.000Z" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.artifact.csv.sha256).toBe(first.artifact.csv.sha256);
    expect(storagePut).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(1);
  });

  it("applies retention only through an explicit owner scope and makes repeated cleanup safe", async () => {
    const cutoff = retentionCutoff(new Date("2028-02-01T00:00:00.000Z"), 24);
    expect(cutoff.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    const first = await retireExpiredMonthlyReportArtifacts(new Date("2028-02-01T00:00:00.000Z"), 24, "owner-1");
    const second = await retireExpiredMonthlyReportArtifacts(new Date("2028-02-02T00:00:00.000Z"), 24, "owner-1");
    expect(first).toMatchObject({ ownerOpenId: "owner-1", affectedRows: 1 });
    expect(second.ownerOpenId).toBe("owner-1");
    expect(updateWhere).toHaveBeenCalledTimes(2);
    await expect(retireExpiredMonthlyReportArtifacts(new Date(), 24, "other-workspace")).rejects.toThrow("not authorized");
  });

  it("enforces the existing admin-owner boundary and rejects cross-workspace identities", () => {
    expect(canAccessMonthlyReportArtifacts(null)).toBe(false);
    expect(canAccessMonthlyReportArtifacts({ openId: "owner-1", role: "user" })).toBe(false);
    expect(canAccessMonthlyReportArtifacts({ openId: "other-workspace", role: "admin" })).toBe(false);
    expect(canAccessMonthlyReportArtifacts({ openId: "owner-1", role: "admin" })).toBe(true);
  });

  it("keeps the existing direct period metadata accessor and valid PDF artifact format", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    const artifact = await getMonthlyReportArtifact(2026, 1);
    const pdf = printableMonthlyHtmlToPdf(generatedReport().printableHtml);
    expect(artifact?.year).toBe(2026);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("Januari 2026");
  });
});
