import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = { openId: "owner-1", role: "admin" };
const OTHER_ADMIN = { openId: "other-workspace", role: "admin" };
const MEMBER = { openId: "owner-1", role: "user" };

const h = vi.hoisted(() => {
  const objects = new Map<string, Buffer>();
  const rows: any[] = [];
  return {
    objects,
    rows,
    getMonthlyReportActiveArtifactSummary: vi.fn(),
    storagePut: vi.fn(async (key: string, data: Buffer) => {
      const stored = `${key.replace(/\.(csv|html|pdf)$/, "")}_abcd1234.${key.split(".").pop()}`;
      objects.set(stored, Buffer.from(data));
      return { key: stored, url: `/manus-storage/${stored}` };
    }),
    storageGetBytes: vi.fn(async (key: string) => {
      const data = objects.get(key);
      if (!data) throw Object.assign(new Error("Stored artifact was not found"), { code: "STORAGE_NOT_FOUND" });
      return { key, data: Buffer.from(data), contentType: null };
    }),
    indexRetentionSummaryExport: vi.fn(async (input: any) => {
      const existing = rows.find((row) => row.ownerOpenId === input.ownerOpenId && row.exportId === input.exportId);
      if (existing) return { outcome: "already_indexed", record: existing };
      const record = { id: rows.length + 1, createdAt: new Date(), ...input };
      rows.push(record);
      return { outcome: "indexed", record };
    }),
    getRetentionSummaryExportIndex: vi.fn(async (ownerOpenId: string, exportId: string) => rows.find((row) => row.ownerOpenId === ownerOpenId && row.exportId === exportId) ?? null),
  };
});

vi.mock("./monthlyReportArtifacts", () => ({
  canAccessMonthlyReportArtifacts: (user: { openId: string; role: string } | null | undefined) => user?.openId === "owner-1" && user.role === "admin",
  getMonthlyReportActiveArtifactSummary: h.getMonthlyReportActiveArtifactSummary,
}));
vi.mock("./storage", () => ({ storagePut: h.storagePut, storageGetBytes: h.storageGetBytes }));
vi.mock("./db", () => ({ indexRetentionSummaryExport: h.indexRetentionSummaryExport, getRetentionSummaryExportIndex: h.getRetentionSummaryExportIndex }));

import {
  buildRetentionSummaryBytes,
  buildRetentionSummarySnapshot,
  createRetentionSummaryExport,
  formatRetentionSummaryWib,
  getRetentionSummaryExport,
  retentionSummaryRows,
  retentionSummaryScopeId,
  verifyRetentionSummaryExport,
} from "./retentionSummaryExport";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const range = { datePreset: "last_3_months" as const };
const now = new Date("2026-10-07T17:30:45.678Z"); // 2026-10-08 00:30:45 WIB (Jakarta date rolls over)

const authoritativeSummary = (overrides: Record<string, unknown> = {}) => ({
  timezone: "Asia/Jakarta" as const,
  range: { preset: "last_3_months", label: "3 bulan terakhir", startDate: "2026-07-01", endDate: "2026-09-30", startWib: "2026-07-01 00:00 WIB", endWib: "2026-10-01 00:00 WIB", boundary: "start_inclusive_end_exclusive_wib" as const },
  calendarPeriodCount: 3,
  activeArtifactCount: 12,
  artifactTypeCounts: { csv: 4, html: 4, pdf: 4 },
  oldestActiveArtifact: null,
  newestActiveArtifact: null,
  integrity: { verifiedBundleCount: 4, excludedBundleCount: 0, availabilityCounts: { available: 12, missing: 0, corrupt: 0, retired: 0, archived: 0 } },
  retention: {
    retentionMonths: 24,
    archiveWarningWindowDays: 90,
    evaluatedAt: now,
    normalArtifactCount: 3,
    approachingArtifactCount: 6,
    eligibleArtifactCount: 3,
    approachingArtifactTypeCounts: { csv: 2, html: 2, pdf: 2 },
    oldestApproachingArtifact: { year: 2024, month: 11, generatedAt: new Date("2024-12-01T00:10:00.000Z"), archiveEligibleAt: new Date("2026-12-01T00:10:00.000Z") },
    oldestEligibleArtifact: { year: 2024, month: 8, generatedAt: new Date("2024-09-01T00:10:00.000Z"), archiveEligibleAt: new Date("2026-09-01T00:10:00.000Z") },
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.objects.clear();
  h.rows.splice(0, h.rows.length);
  h.getMonthlyReportActiveArtifactSummary.mockResolvedValue(authoritativeSummary());
});

async function created(format: "csv" | "html" | "pdf" = "csv", user = OWNER) {
  const result = await createRetentionSummaryExport(user, range, format, now);
  if (result.outcome === "empty") throw new Error("unexpected empty");
  return result;
}

describe("Phase 2.23 retention summary export", () => {
  it("AT-001/AT-005 exports for the owner-admin using only the authoritative summary at a server-truncated evaluation time", async () => {
    const result = await created("csv");
    expect(result.outcome).toBe("created");
    expect(h.getMonthlyReportActiveArtifactSummary).toHaveBeenCalledTimes(1);
    expect(h.getMonthlyReportActiveArtifactSummary).toHaveBeenCalledWith("owner-1", range, new Date("2026-10-07T17:30:45.000Z"));
    expect(result.export.summary).toEqual({ totalActive: 12, normal: 3, approachingThreshold: 6, eligibleForArchive: 3 });
    expect(result.export.formatBreakdown.pdf).toEqual({ active: 4, normal: 1, approachingThreshold: 2, eligibleForArchive: 1 });
    expect(result.export.review).toMatchObject({ label: "3 bulan terakhir", startDate: "2026-07-01", endDate: "2026-09-30", calendarPeriodCount: 3 });
    expect(result.export.retentionThreshold).toEqual({ value: 24, unit: "months", warningWindowDays: 90 });
  });

  it("AT-004 renders the evaluation timestamp in Asia/Jakarta, including across the UTC date boundary", async () => {
    expect(formatRetentionSummaryWib("2026-10-07T17:30:45.000Z")).toBe("2026-10-08 00:30:45 WIB");
    const { bytesBase64, export: record } = await created("csv");
    const text = Buffer.from(bytesBase64, "base64").toString("utf8");
    expect(text).toContain('"Waktu evaluasi","2026-10-08 00:30:45 WIB"');
    expect(text).toContain('"Timezone","Asia/Jakarta"');
    expect(record.timezone).toBe("Asia/Jakarta");
    expect(record.evaluatedAt).toEqual(new Date("2026-10-07T17:30:45.000Z"));
  });

  it("AT-006 emits a UTF-8 BOM CSV with a stable header, CRLF rows, review scope, classification, and retention metadata", async () => {
    const { bytesBase64 } = await created("csv");
    const bytes = Buffer.from(bytesBase64, "base64");
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = bytes.toString("utf8").slice(1);
    expect(text.startsWith('"Bagian","Kunci","Nilai"\r\n')).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    for (const fragment of [
      '"Scope","owner-scope:', '"Preset","3 bulan terakhir"', '"Mulai (WIB, inklusif)","2026-07-01 00:00 WIB"', '"Akhir (WIB, eksklusif)","2026-10-01 00:00 WIB"',
      '"Total artefak aktif","12"', '"Normal (NORMAL)","3"', '"Mendekati batas retensi (APPROACHING_THRESHOLD)","6"', '"Memenuhi syarat arsip (ELIGIBLE_FOR_ARCHIVE)","3"',
      '"CSV · Aktif","4"', '"HTML · Aktif","4"', '"PDF · Aktif","4"', '"Ambang retensi","24 bulan"', '"Jendela peringatan","90 hari"',
    ]) expect(text).toContain(fragment);
    expect(text).not.toContain("owner-1");
  });

  it("selects the oldest eligible candidate first, falls back to the oldest approaching one, and states when there is none", async () => {
    const eligible = buildRetentionSummarySnapshot("owner-1", authoritativeSummary() as any, now);
    expect(eligible.oldestCandidate).toMatchObject({ classification: "ELIGIBLE_FOR_ARCHIVE", year: 2024, month: 8 });
    const approaching = buildRetentionSummarySnapshot("owner-1", authoritativeSummary({ retention: { ...authoritativeSummary().retention, oldestEligibleArtifact: null, eligibleArtifactCount: 0, normalArtifactCount: 6 } }) as any, now);
    expect(approaching.oldestCandidate).toMatchObject({ classification: "APPROACHING_THRESHOLD", year: 2024, month: 11 });
    const none = buildRetentionSummarySnapshot("owner-1", authoritativeSummary({ retention: { ...authoritativeSummary().retention, oldestEligibleArtifact: null, oldestApproachingArtifact: null } }) as any, now);
    expect(none.oldestCandidate).toBeNull();
    expect(retentionSummaryRows(none)).toContainEqual(["Konteks retensi", "Kandidat tertua", "Tidak ada"]);
    const text = retentionSummaryRows(eligible).map((row) => row.join("|")).join("\n");
    expect(text).toContain("Kandidat tertua · Periode laporan|2024-08");
    expect(text).toContain("Kandidat tertua · Memenuhi syarat arsip sejak|2026-09-01 07:10:00 WIB");
  });

  it("AT-007 produces printable HTML that carries the same logical rows and escapes content", async () => {
    const { bytesBase64 } = await created("html");
    const html = Buffer.from(bytesBase64, "base64").toString("utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("@media print");
    expect(html).toContain("2026-10-08 00:30:45 WIB");
    const snapshot = buildRetentionSummarySnapshot("owner-1", authoritativeSummary() as any, new Date("2026-10-07T17:30:45.000Z"));
    for (const [, key, value] of retentionSummaryRows(snapshot)) {
      expect(html).toContain(String(key).replaceAll("&", "&amp;"));
      expect(html).toContain(String(value).replaceAll("&", "&amp;"));
    }
  });

  it("AT-008 produces a real server-side PDF for the same snapshot, deterministically", async () => {
    const snapshot = buildRetentionSummarySnapshot("owner-1", authoritativeSummary() as any, new Date("2026-10-07T17:30:45.000Z"));
    const first = buildRetentionSummaryBytes(snapshot, "pdf");
    const second = buildRetentionSummaryBytes(snapshot, "pdf");
    expect(first.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(first.subarray(-6).toString("latin1")).toContain("%%EOF");
    expect(first.equals(second)).toBe(true);
    const text = first.toString("latin1");
    expect(text).toContain("Retention Summary Export");
    expect(text).toContain("2026-10-08 00:30:45 WIB");
  });

  it("AT-009/AT-010 hashes the exact stored bytes, reports their real length, and derives a deterministic export ID", async () => {
    for (const format of ["csv", "html", "pdf"] as const) {
      const result = await created(format);
      const bytes = Buffer.from(result.bytesBase64, "base64");
      const [, storedBytes] = [...h.objects.entries()].at(-1)!;
      expect(storedBytes.equals(bytes)).toBe(true);
      expect(result.export.sha256).toBe(sha(bytes));
      expect(result.export.byteSize).toBe(bytes.byteLength);
      expect(result.export.exportId).toBe(`storeos-retention-summary-${format}-${sha(bytes)}`);
      expect(result.export.availability).toBe("available");
    }
  });

  it("is deterministic and idempotent: an identical snapshot yields the same bytes, ID, one stored object and one index row", async () => {
    const first = await created("pdf");
    const second = await createRetentionSummaryExport(OWNER, range, "pdf", new Date(now.getTime() + 300));
    expect(second.outcome).toBe("already_exported");
    if (second.outcome === "empty") throw new Error("unexpected");
    expect(second.export.exportId).toBe(first.export.exportId);
    expect(second.bytesBase64).toBe(first.bytesBase64);
    expect(h.storagePut).toHaveBeenCalledTimes(1);
    expect(h.rows).toHaveLength(1);
  });

  it("AT-011 verifies stored exact bytes as VERIFIED for every format", async () => {
    for (const format of ["csv", "html", "pdf"] as const) {
      const { export: record } = await created(format);
      await expect(verifyRetentionSummaryExport(OWNER, record.exportId)).resolves.toMatchObject({ status: "VERIFIED", format, expectedSha256: record.sha256, actualSha256: record.sha256, expectedByteSize: record.byteSize, actualByteSize: record.byteSize });
    }
  });

  it("AT-012 reports MISMATCH for modified bytes without repairing, overwriting the expected hash, or serving the bytes", async () => {
    const { export: record } = await created("csv");
    const [key, original] = [...h.objects.entries()][0];
    const tampered = Buffer.concat([original, Buffer.from("tampered")]);
    h.objects.set(key, tampered);
    const writesBefore = h.storagePut.mock.calls.length;
    const verification = await verifyRetentionSummaryExport(OWNER, record.exportId);
    expect(verification).toMatchObject({ status: "MISMATCH", expectedSha256: record.sha256, actualSha256: sha(tampered), expectedByteSize: record.byteSize, actualByteSize: tampered.byteLength });
    expect(verification.actualSha256).not.toBe(verification.expectedSha256);
    expect(h.rows[0].sha256).toBe(record.sha256);
    expect(h.storagePut.mock.calls.length).toBe(writesBefore);
    expect(h.objects.get(key)!.equals(tampered)).toBe(true);
    expect(h.indexRetentionSummaryExport).toHaveBeenCalledTimes(1);
    await expect(getRetentionSummaryExport(OWNER, record.exportId)).resolves.toEqual({ status: "MISMATCH", exportId: record.exportId });
  });

  it("AT-013 never reports VERIFIED or fabricates bytes when metadata exists but the stored object is missing", async () => {
    const { export: record } = await created("pdf");
    h.objects.clear();
    await expect(verifyRetentionSummaryExport(OWNER, record.exportId)).resolves.toMatchObject({ status: "NOT_FOUND", reason: "artifact_bytes_unavailable", expectedSha256: record.sha256 });
    await expect(getRetentionSummaryExport(OWNER, record.exportId)).resolves.toEqual({ status: "NOT_FOUND", exportId: record.exportId, reason: "artifact_bytes_unavailable" });
    expect(h.storagePut).toHaveBeenCalledTimes(1);
  });

  it("returns NOT_FOUND for unknown or malformed export IDs without reading storage", async () => {
    await expect(verifyRetentionSummaryExport(OWNER, `storeos-retention-summary-csv-${"f".repeat(64)}`)).resolves.toEqual({ status: "NOT_FOUND", exportId: `storeos-retention-summary-csv-${"f".repeat(64)}`, reason: "export_not_found" });
    await expect(verifyRetentionSummaryExport(OWNER, "../../etc/passwd")).resolves.toMatchObject({ status: "NOT_FOUND", reason: "export_not_found" });
    expect(h.storageGetBytes).not.toHaveBeenCalled();
  });

  it("AT-002 denies non-owner access before any summary, storage, or metadata is touched", async () => {
    const { export: record } = await created("csv");
    vi.clearAllMocks();
    for (const user of [OTHER_ADMIN, MEMBER, null, undefined]) {
      await expect(createRetentionSummaryExport(user, range, "csv", now)).rejects.toThrow("dibatasi untuk pemilik StoreOS");
      await expect(verifyRetentionSummaryExport(user, record.exportId)).resolves.toEqual({ status: "UNAUTHORIZED", exportId: record.exportId });
      await expect(getRetentionSummaryExport(user, record.exportId)).resolves.toEqual({ status: "UNAUTHORIZED", exportId: record.exportId });
    }
    expect(h.getMonthlyReportActiveArtifactSummary).not.toHaveBeenCalled();
    expect(h.getRetentionSummaryExportIndex).not.toHaveBeenCalled();
    expect(h.storageGetBytes).not.toHaveBeenCalled();
    expect(h.storagePut).not.toHaveBeenCalled();
  });

  it("AT-003 denies cross-scope access before bytes are read and reveals nothing about the other scope", async () => {
    const { export: record } = await created("csv");
    h.rows.push({ ...h.rows[0], id: 99, ownerOpenId: "owner-2" });
    vi.clearAllMocks();
    // A foreign scope's row is invisible to owner-1's lookups (and vice versa): indistinguishable from unknown.
    h.rows[1].exportId = `storeos-retention-summary-csv-${"e".repeat(64)}`;
    const foreign = await verifyRetentionSummaryExport(OWNER, h.rows[1].exportId);
    expect(foreign).toEqual({ status: "NOT_FOUND", exportId: h.rows[1].exportId, reason: "export_not_found" });
    expect(h.storageGetBytes).not.toHaveBeenCalled();
    expect(JSON.stringify(foreign)).not.toMatch(/owner-2|storageKey|retention-summary-exports/);
    await expect(getRetentionSummaryExport(OWNER, h.rows[1].exportId)).resolves.toMatchObject({ status: "NOT_FOUND", reason: "export_not_found" });
    expect(h.getRetentionSummaryExportIndex).toHaveBeenCalledWith("owner-1", h.rows[1].exportId);
    expect(record.exportId).not.toBe(h.rows[1].exportId);
  });

  it("serves bytes through the protected getter only when they still match, and never exposes storage keys", async () => {
    const { export: record, bytesBase64 } = await created("csv");
    const served = await getRetentionSummaryExport(OWNER, record.exportId);
    expect(served).toMatchObject({ status: "AVAILABLE", bytesBase64 });
    expect(JSON.stringify(served)).not.toMatch(/storageKey|retention-summary-exports\/|manus-storage/);
    expect(JSON.stringify(record)).not.toMatch(/storageKey|retention-summary-exports\/|manus-storage/);
  });

  it("does not create or store anything for an empty scope, so no artifact appears available", async () => {
    h.getMonthlyReportActiveArtifactSummary.mockResolvedValue(authoritativeSummary({ activeArtifactCount: 0, artifactTypeCounts: { csv: 0, html: 0, pdf: 0 }, retention: { ...authoritativeSummary().retention, normalArtifactCount: 0, approachingArtifactCount: 0, eligibleArtifactCount: 0, oldestApproachingArtifact: null, oldestEligibleArtifact: null } }));
    const result = await createRetentionSummaryExport(OWNER, range, "csv", now);
    expect(result).toMatchObject({ outcome: "empty", timezone: "Asia/Jakarta", review: { label: "3 bulan terakhir", calendarPeriodCount: 3 } });
    expect(result).not.toHaveProperty("export");
    expect(result).not.toHaveProperty("bytesBase64");
    expect(h.storagePut).not.toHaveBeenCalled();
    expect(h.indexRetentionSummaryExport).not.toHaveBeenCalled();
  });

  it("surfaces a deterministic storage failure without writing an index row, and a read failure without leaking details", async () => {
    h.storagePut.mockRejectedValueOnce(new Error("Storage presign failed (500): secret-bucket-detail"));
    await expect(createRetentionSummaryExport(OWNER, range, "csv", now)).rejects.toThrow("Storage presign failed");
    expect(h.indexRetentionSummaryExport).not.toHaveBeenCalled();
    expect(h.rows).toHaveLength(0);

    const { export: record } = await created("csv");
    h.storageGetBytes.mockRejectedValueOnce(new Error("Storage download failed (503) secret-bucket-detail"));
    await expect(verifyRetentionSummaryExport(OWNER, record.exportId)).rejects.toThrow("Penyimpanan ekspor ringkasan retensi tidak dapat diakses");
  });

  it("AT-014 is read-only: the only writes are one storage object and one metadata row; the summary is requested read-only", async () => {
    await created("csv");
    await verifyRetentionSummaryExport(OWNER, h.rows[0].exportId);
    await getRetentionSummaryExport(OWNER, h.rows[0].exportId);
    expect(h.storagePut).toHaveBeenCalledTimes(1);
    expect(h.indexRetentionSummaryExport).toHaveBeenCalledTimes(1);
    expect(h.getMonthlyReportActiveArtifactSummary).toHaveBeenCalledTimes(1);
    expect(h.storageGetBytes).toHaveBeenCalledTimes(2);
  });

  it("uses an opaque stable scope identifier and an owner-namespaced storage key", async () => {
    expect(retentionSummaryScopeId("owner-1")).toMatch(/^owner-scope:[a-f0-9]{12}$/);
    expect(retentionSummaryScopeId("owner-1")).toBe(retentionSummaryScopeId("owner-1"));
    expect(retentionSummaryScopeId("owner-1")).not.toBe(retentionSummaryScopeId("owner-2"));
    await created("csv");
    expect(h.storagePut.mock.calls[0][0]).toMatch(new RegExp(`^retention-summary-exports/${retentionSummaryScopeId("owner-1").slice(12)}/storeos-retention-summary-csv-[a-f0-9]{64}\\.csv$`));
    expect(h.storagePut.mock.calls[0][2]).toBe("text/csv;charset=utf-8");
  });
});
