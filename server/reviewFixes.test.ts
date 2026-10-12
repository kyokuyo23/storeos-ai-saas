import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getRetentionSummaryExportIndex: vi.fn(), indexRetentionSummaryExport: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn(), storageGetBytes: vi.fn() }));
vi.mock("./monthlyReportArtifacts", () => ({ canAccessMonthlyReportArtifacts: () => true, getMonthlyReportActiveArtifactSummary: vi.fn() }));

import { TRPCError } from "@trpc/server";
import { buildRetentionSummaryBytes, buildRetentionSummarySnapshot, pdfWibDate, retentionSummaryRows } from "./retentionSummaryExport";
import { mapFoundationError } from "./foundationErrors";
import { isRawInternalError } from "./_core/trpc";
import { ownerLoginConfigProblem } from "./_core/ownerLogin";
import { safeNextPath } from "../client/src/pages/OwnerLogin";

const summary = (overrides: Record<string, unknown> = {}) => ({
  range: { preset: "last_3_months", label: "3 bulan terakhir", startDate: "2026-08-01", endDate: "2026-10-31", startWib: "2026-08-01 00:00:00 WIB", endWib: "2026-11-01 00:00:00 WIB", boundary: "start_inclusive_end_exclusive_wib" },
  calendarPeriodCount: 3,
  activeArtifactCount: 6,
  artifactTypeCounts: { csv: 2, html: 2, pdf: 2 },
  integrity: { verifiedBundleCount: 2, excludedBundleCount: 1, availabilityCounts: { available: 6, missing: 1, corrupt: 2, retired: 0, archived: 0 } },
  retention: {
    retentionMonths: 24, archiveWarningWindowDays: 90,
    normalArtifactCount: 3, approachingArtifactCount: 3, eligibleArtifactCount: 0,
    oldestEligibleArtifact: null,
    oldestApproachingArtifact: { year: 2024, month: 11, generatedAt: new Date("2024-12-01T00:10:00.000Z"), archiveEligibleAt: new Date("2026-12-01T00:10:00.000Z") },
  },
  ...overrides,
});
const evaluatedAt = new Date("2026-10-07T17:30:45.000Z");

describe("review fixes — Phase 2.23 export", () => {
  it("PDF bytes and creation date are independent of the server timezone (WIB fixed)", () => {
    const snapshot = buildRetentionSummarySnapshot("owner-1", summary() as any, evaluatedAt);
    const original = process.env.TZ;
    const hashes = new Set<string>();
    try {
      for (const tz of ["UTC", "Asia/Jakarta", "America/New_York"]) {
        process.env.TZ = tz;
        const bytes = buildRetentionSummaryBytes(snapshot, "pdf");
        expect(bytes.toString("latin1")).toContain("/CreationDate (D:20261008003045+07'00')");
        hashes.add(require("node:crypto").createHash("sha256").update(bytes).digest("hex"));
      }
    } finally {
      process.env.TZ = original;
    }
    expect(hashes.size).toBe(1);
    expect(pdfWibDate("2026-10-07T17:30:45.000Z")).toBe("D:20261008003045+07'00'");
  });

  it("labels an approaching candidate as a future date, never 'sejak'", () => {
    const rows = retentionSummaryRows(buildRetentionSummarySnapshot("owner-1", summary() as any, evaluatedAt));
    const keys = rows.map((row) => row[1]);
    expect(keys).toContain("Kandidat tertua · Akan memenuhi syarat arsip pada");
    expect(keys).not.toContain("Kandidat tertua · Memenuhi syarat arsip sejak");
  });

  it("discloses excluded (missing/corrupt) bundles alongside the counted totals", () => {
    const rows = retentionSummaryRows(buildRetentionSummarySnapshot("owner-1", summary() as any, evaluatedAt));
    expect(rows).toContainEqual(["Integritas", "Bundle terverifikasi (dihitung)", 2]);
    expect(rows).toContainEqual(["Integritas", "Bundle dikecualikan (hilang/rusak, tidak dihitung)", 1]);
    const csv = buildRetentionSummaryBytes(buildRetentionSummarySnapshot("owner-1", summary() as any, evaluatedAt), "csv").toString("utf8");
    expect(csv).toContain('"Integritas","Bundle dikecualikan (hilang/rusak, tidak dihitung)","1"');
  });

  it("PDF text separates cells and does not duplicate the title", () => {
    const pdf = buildRetentionSummaryBytes(buildRetentionSummarySnapshot("owner-1", summary() as any, evaluatedAt), "pdf").toString("latin1");
    expect(pdf).toContain("Klasifikasi | Total artefak aktif | 6");
    expect(pdf).not.toContain("StoreOS Retention Summary Export StoreOS Retention Summary Export");
  });
});

describe("review fixes — errors and login", () => {
  it("maps wrapped connection errors to SERVICE_UNAVAILABLE and keeps the outer message", () => {
    expect(mapFoundationError(Object.assign(new Error("Failed query"), { cause: { code: "ECONNREFUSED" } }), "Bahan").code).toBe("SERVICE_UNAVAILABLE");
    expect(mapFoundationError(new Error("Penyimpanan ekspor ringkasan retensi tidak dapat diakses. Silakan coba lagi."), "Verifikasi").code).toBe("SERVICE_UNAVAILABLE");
  });

  it("recognizes raw SQL/driver errors so they are never sent to clients", () => {
    expect(isRawInternalError(Object.assign(new Error("Failed query: select * from users where id = ? params: 1"), { cause: { code: "ER_NO_SUCH_TABLE" } }))).toBe(true);
    expect(isRawInternalError({ code: "ER_PARSE_ERROR", sqlMessage: "near 'x'" })).toBe(true);
    expect(isRawInternalError(new Error("Database tidak tersedia. Silakan coba lagi."))).toBe(false);
    expect(isRawInternalError(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kategori gagal disimpan." }))).toBe(false);
  });

  it("refuses weak or unsafe owner login configuration", () => {
    expect(ownerLoginConfigProblem({ ownerPassword: "", ownerOpenId: "owner-1" })).toMatch(/belum dikonfigurasi/);
    expect(ownerLoginConfigProblem({ ownerPassword: "short", ownerOpenId: "owner-1" })).toMatch(/terlalu pendek/);
    expect(ownerLoginConfigProblem({ ownerPassword: "a-long-enough-pass", ownerOpenId: "cron_owner" })).toMatch(/cron_/);
    expect(ownerLoginConfigProblem({ ownerPassword: "a-long-enough-pass", ownerOpenId: "owner-1" })).toBeNull();
  });

  it("only allows same-origin paths after login (no open redirect)", () => {
    expect(safeNextPath("/verify?ref=abc")).toBe("/verify?ref=abc");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
});
