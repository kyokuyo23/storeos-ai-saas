import { describe, expect, it, vi, beforeEach } from "vitest";

const { artifactRows, lifecycleEvents, objects, storagePut, storageGetBytes, db, updateWhere } = vi.hoisted(() => {
  const artifactRows: any[] = [];
  const lifecycleEvents: any[] = [];
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
  const selectRows = (table: any) => {
    const source = table?.artifactId ? lifecycleEvents : artifactRows;
    const selection = source.slice() as any;
    selection.where = () => selection;
    selection.limit = async (count: number) => source.slice(0, count);
    return selection;
  };
  const updateWhere = vi.fn(async (values: any) => {
    const target = values.lifecycleStatus === "eligible_for_archive"
      ? artifactRows.find((row) => row.lifecycleStatus === "retained" && !row.retiredAt && !row.archivedAt)
      : values.lifecycleStatus === "archived"
        ? artifactRows.find((row) => row.lifecycleStatus === "eligible_for_archive" && !row.retiredAt && !row.archivedAt)
        : artifactRows.find((row) => !row.retiredAt && !row.archivedAt);
    if (!target) return { affectedRows: 0 };
    Object.assign(target, values);
    return { affectedRows: 1 };
  });
  const db = {
    select: () => ({ from: (table: any) => selectRows(table) }),
    insert: () => ({
      values: async (value: any) => {
        if ("artifactId" in value) {
          lifecycleEvents.push({ id: lifecycleEvents.length + 1, ...value });
          return [{ insertId: lifecycleEvents.length }];
        }
        artifactRows.push({
          id: artifactRows.length + 1,
          ...value,
          lifecycleStatus: value.lifecycleStatus ?? "retained",
          verifiedAt: value.verifiedAt ?? null,
          retainedAt: value.retainedAt ?? null,
          archiveEligibleAt: value.archiveEligibleAt ?? null,
          archivedAt: value.archivedAt ?? null,
          archiveReason: value.archiveReason ?? null,
          retiredAt: value.retiredAt ?? null,
          createdAt: new Date("2026-02-01T00:15:00.000Z"),
        });
        return [{ insertId: artifactRows.length }];
      },
    }),
    update: () => ({ set: (values: any) => ({ where: () => updateWhere(values) }) }),
  };
  return { artifactRows, lifecycleEvents, objects, storagePut, storageGetBytes, db, updateWhere };
});

vi.mock("./storage", () => ({ storagePut, storageGetBytes }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => db) }));
vi.mock("./_core/env", () => ({ ENV: { ownerOpenId: "owner-1" } }));

import {
  archiveMonthlyReportArtifactWithOwnerApproval,
  archiveEligibleMonthlyReportArtifacts,
  canAccessMonthlyReportArtifacts,
  getMonthlyReportArtifact,
  getMonthlyReportArtifactGovernanceAuditExport,
  getMonthlyReportArtifactGovernanceSummary,
  getMonthlyReportArtifactLifecycleEvents,
  getMonthlyReportArtifactLifecycleHistory,
  listMonthlyReportArtifacts,
  markMonthlyReportArtifactsEligibleForArchive,
  persistMonthlyReportArtifacts,
  readVerifiedMonthlyReportArtifact,
  retentionCutoff,
  verifyMonthlyReportArtifact,
} from "./monthlyReportArtifacts";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";

function generatedReport(overrides: { year?: number; month?: number; generatedAt?: string; csv?: string; printableHtml?: string } = {}) {
  const year = overrides.year ?? 2026;
  const month = overrides.month ?? 1;
  const generatedAt = overrides.generatedAt ?? "2026-02-01T00:15:00.000Z";
  const label = `Laporan ${month}/${year}`;
  const printableHtml = overrides.printableHtml ?? `<!doctype html><html><body>${label} · Generated At: ${generatedAt} · Periksa selisih</body></html>`;
  return {
    report: {
      period: { year, month, label, startDate: `${year}-${String(month).padStart(2, "0")}-01`, endDate: `${year}-${String(month).padStart(2, "0")}-28`, timezone: "Asia/Jakarta" },
      generatedAt,
      auditNotes: [{ reference: "OPN-01", type: "follow_up", note: "Periksa selisih" }],
      financial: { grossSales: 0, netRevenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, salesTransactionCount: 0, refundValue: 0, voidValue: 0, exchangeImpact: 0 },
      inventory: { openingStock: 0, closingStock: 0, expectedStock: 0, actualStock: 0, totalVariance: 0, outOfToleranceItemCount: 0, highValueVarianceCount: 0, recurringHighVarianceIngredientCount: 0, stockOpnameSessionCount: 0, openStockOpnameFollowUpCount: 0 },
      source: { financial: "Financial Core", inventory: "Inventory Intelligence", auditNotes: "Stock Opname + Follow-up", recurringVariancePeriods: [] },
    },
    csv: overrides.csv ?? `\ufeff"Periode mulai","${year}-${String(month).padStart(2, "0")}-01"\n"Audit Notes","Periksa selisih"\n`,
    printableHtml,
    pdf: printableMonthlyHtmlToPdf(printableHtml),
    generatedAt,
  } as any;
}

describe("Phase 2.4 monthly report artifact governance", () => {
  beforeEach(() => {
    artifactRows.length = 0;
    lifecycleEvents.length = 0;
    objects.clear();
    storagePut.mockClear();
    storageGetBytes.mockClear();
    updateWhere.mockClear();
  });

  it("persists immutable CSV, HTML, and PDF artifacts with generated, verified, and retained lifecycle audit events", async () => {
    const result = await persistMonthlyReportArtifacts(generatedReport());
    expect(result.created).toBe(true);
    expect(result.artifact).toMatchObject({ ownerOpenId: "owner-1", year: 2026, month: 1, lifecycleStatus: "retained", timezone: "Asia/Jakarta" });
    expect(result.artifact.csv.sha256).toHaveLength(64);
    expect(result.artifact.pdf.bytes).toBeGreaterThan(0);
    expect(storagePut).toHaveBeenCalledTimes(3);
    expect(artifactRows[0]).not.toHaveProperty("saleId");
    expect(artifactRows[0]).not.toHaveProperty("ingredientId");
    expect(lifecycleEvents.map((event) => event.lifecycleStatus)).toEqual(["generated", "verified", "retained"]);
  });

  it("lists only active production artifacts with verified availability and no raw storage paths", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    const list = await listMonthlyReportArtifacts("owner-1", { year: 2026 });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ lifecycleStatus: "retained", csv: { status: "available" }, printableHtml: { status: "available" }, pdf: { status: "available" } });
    expect(JSON.stringify(list[0])).not.toContain("monthly-management-reports/");
  });

  it("serves only verified bytes and rejects missing or corrupt storage content", async () => {
    const persisted = await persistMonthlyReportArtifacts(generatedReport());
    const valid = await readVerifiedMonthlyReportArtifact(2026, 1, "csv", "owner-1");
    expect(valid?.data?.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    objects.delete(persisted.artifact.pdf.key);
    expect((await verifyMonthlyReportArtifact(persisted.artifact, "pdf")).status).toBe("missing");
    objects.set(persisted.artifact.csv.key, Buffer.from("tampered"));
    expect((await verifyMonthlyReportArtifact(persisted.artifact, "csv")).status).toBe("corrupt");
  });

  it("prevents duplicate-period overwrite and retains the original artifact hash", async () => {
    const first = await persistMonthlyReportArtifacts(generatedReport());
    const second = await persistMonthlyReportArtifacts(generatedReport({ csv: "different", printableHtml: "different" }));
    expect(first.created).toBe(true);
    expect(second).toMatchObject({ created: false, artifact: { csv: { sha256: first.artifact.csv.sha256 } } });
    expect(artifactRows).toHaveLength(1);
    expect(storagePut).toHaveBeenCalledTimes(3);
  });

  it("transitions an expired artifact through eligible_for_archive to archived exactly once and preserves audit metadata", async () => {
    await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 1, generatedAt: "2024-02-01T00:15:00.000Z" }));
    const now = new Date("2026-02-02T00:00:00.000Z");
    expect(retentionCutoff(now, 24).toISOString()).toBe("2024-02-02T00:00:00.000Z");
    const eligible = await markMonthlyReportArtifactsEligibleForArchive(now, 24, "owner-1");
    expect(eligible.affectedRows).toBe(1);
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "eligible_for_archive", archiveEligibleAt: now, archivedAt: null });
    const archived = await archiveEligibleMonthlyReportArtifacts(now, "owner-1");
    const repeated = await archiveEligibleMonthlyReportArtifacts(now, "owner-1");
    expect(archived.affectedRows).toBe(1);
    expect(repeated.affectedRows).toBe(0);
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "archived", archivedAt: now, retiredAt: now, archiveReason: "retention_window_elapsed" });
    expect(lifecycleEvents.map((event) => event.lifecycleStatus)).toEqual(["generated", "verified", "retained", "eligible_for_archive", "archived"]);
    expect(await listMonthlyReportArtifacts("owner-1")).toEqual([]);
    expect(await readVerifiedMonthlyReportArtifact(2024, 1, "pdf", "owner-1")).toBeNull();
  });

  it("reports active retained totals, per-artifact-type counts, oldest period, and archive-threshold visibility without counting non-production objects", async () => {
    await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 6, generatedAt: "2024-07-01T00:15:00.000Z" }));
    await persistMonthlyReportArtifacts(generatedReport({ year: 2025, month: 1, generatedAt: "2025-02-01T00:15:00.000Z" }));
    artifactRows.push({ ...artifactRows[0], id: 99, year: 2020, month: 1, csvKey: "nonproduction-e2e/phase2-2/report.csv", htmlKey: "nonproduction-e2e/phase2-2/report.html", pdfKey: "nonproduction-e2e/phase2-2/report.pdf" });
    const summary = await getMonthlyReportArtifactGovernanceSummary("owner-1", new Date("2026-05-01T00:00:00.000Z"));
    expect(summary).toMatchObject({ retainedArtifactCount: 2, artifactTypeCounts: { csv: 2, html: 2, pdf: 2 }, oldestRetainedReport: { year: 2024, month: 6 }, lifecycleCounts: { retained: 2 } });
    expect(summary.approachingArchive).toEqual(expect.arrayContaining([expect.objectContaining({ year: 2024, month: 6 })]));
  });

  it("keeps lifecycle transitions traceable, enforces owner-admin access, and denies cross-scope governance", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    const events = await getMonthlyReportArtifactLifecycleEvents(2026, 1, "owner-1");
    expect(events.map((event) => event.lifecycleStatus)).toEqual(["generated", "verified", "retained"]);
    expect(canAccessMonthlyReportArtifacts(null)).toBe(false);
    expect(canAccessMonthlyReportArtifacts({ openId: "owner-1", role: "user" })).toBe(false);
    expect(canAccessMonthlyReportArtifacts({ openId: "other-workspace", role: "admin" })).toBe(false);
    expect(canAccessMonthlyReportArtifacts({ openId: "owner-1", role: "admin" })).toBe(true);
    expect(await listMonthlyReportArtifacts("other-workspace")).toEqual([]);
    await expect(getMonthlyReportArtifactGovernanceSummary("other-workspace")).rejects.toThrow("not authorized");
  });

  it("returns an append-only chronological lifecycle history for archived artifacts without changing integrity metadata", async () => {
    const persisted = await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 1, generatedAt: "2024-02-01T00:15:00.000Z" }));
    const initialHistory = await getMonthlyReportArtifactLifecycleHistory(2024, 1, "owner-1");
    expect(initialHistory?.events.map((event) => event.lifecycleStatus)).toEqual(["generated", "verified", "retained"]);
    expect(initialHistory?.events.every((event) => event.occurredAt instanceof Date)).toBe(true);
    expect(JSON.stringify(initialHistory?.events[0].integrity)).toContain(persisted.artifact.csv.sha256);

    await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 1, csv: "replacement-must-not-apply" }));
    const afterDuplicate = await getMonthlyReportArtifactLifecycleHistory(2024, 1, "owner-1");
    expect(afterDuplicate?.events).toHaveLength(3);
    expect(JSON.stringify(afterDuplicate?.events[0].integrity)).toContain(persisted.artifact.csv.sha256);

    const now = new Date("2026-02-02T00:00:00.000Z");
    await markMonthlyReportArtifactsEligibleForArchive(now, 24, "owner-1");
    await archiveEligibleMonthlyReportArtifacts(now, "owner-1");
    const archivedHistory = await getMonthlyReportArtifactLifecycleHistory(2024, 1, "owner-1");
    const statuses = archivedHistory?.events.map((event) => event.lifecycleStatus);
    expect(archivedHistory?.artifact).toMatchObject({ lifecycleStatus: "archived", year: 2024, month: 1, timezone: "Asia/Jakarta" });
    expect(statuses).toEqual(["generated", "verified", "retained", "eligible_for_archive", "archived"]);
    const chronology = archivedHistory!.events.map((event) => event.occurredAt.getTime());
    expect(chronology).toEqual([...chronology].sort((left, right) => left - right));
    expect(JSON.stringify(archivedHistory?.events[0].integrity)).toContain(persisted.artifact.csv.sha256);
    expect(await getMonthlyReportArtifactLifecycleHistory(2024, 1, "other-workspace")).toBeNull();
  });

  it("keeps the direct period metadata accessor and valid PDF binary format", async () => {
    await persistMonthlyReportArtifacts(generatedReport());
    expect((await getMonthlyReportArtifact(2026, 1))?.year).toBe(2026);
    expect(printableMonthlyHtmlToPdf(generatedReport().printableHtml).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("archives only an eligible, fully verified CSV/HTML/PDF bundle with owner approval while preserving audit evidence and blocking active retrieval", async () => {
    const persisted = await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 1, generatedAt: "2024-02-01T00:15:00.000Z" }));
    const approvalAt = new Date("2026-02-02T00:00:00.000Z");
    await markMonthlyReportArtifactsEligibleForArchive(approvalAt, 24, "owner-1");
    const immutableIntegrity = { csv: persisted.artifact.csv.sha256, html: persisted.artifact.printableHtml.sha256, pdf: persisted.artifact.pdf.sha256 };

    const result = await archiveMonthlyReportArtifactWithOwnerApproval(2024, 1, "owner-1", "owner-1", approvalAt);

    expect(result).toMatchObject({
      outcome: "archived",
      artifact: { id: persisted.artifact.id, year: 2024, month: 1, lifecycleStatus: "archived" },
      archivedAt: approvalAt,
    });
    expect(result.availability.map((item) => item.status)).toEqual(["available", "available", "available"]);
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "archived", archivedAt: approvalAt, retiredAt: approvalAt, archiveReason: "owner_approved_archive" });
    expect(artifactRows[0].csvSha256).toBe(immutableIntegrity.csv);
    expect(artifactRows[0].htmlSha256).toBe(immutableIntegrity.html);
    expect(artifactRows[0].pdfSha256).toBe(immutableIntegrity.pdf);
    expect(objects.has(persisted.artifact.csv.key)).toBe(true);
    expect(await readVerifiedMonthlyReportArtifact(2024, 1, "csv", "owner-1")).toBeNull();
    expect(await listMonthlyReportArtifacts("owner-1", { year: 2024, month: 1 })).toEqual([]);

    const history = await getMonthlyReportArtifactLifecycleHistory(2024, 1, "owner-1");
    const archiveEvent = history?.events.at(-1);
    expect(archiveEvent).toMatchObject({ lifecycleStatus: "archived", occurredAt: approvalAt, reason: "owner_approved_archive", actor: "owner-1", source: "owner_archive_action", artifactFormat: "bundle" });
    expect(archiveEvent?.integrity).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "csv", sha256: immutableIntegrity.csv }),
      expect.objectContaining({ kind: "html", sha256: immutableIntegrity.html }),
      expect.objectContaining({ kind: "pdf", sha256: immutableIntegrity.pdf }),
    ]));
  });

  it("rejects active or integrity-failed bundles without changing lifecycle metadata or writing an archive event", async () => {
    await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 2, generatedAt: "2024-03-01T00:15:00.000Z" }));
    const approvalAt = new Date("2026-03-02T00:00:00.000Z");
    const active = await archiveMonthlyReportArtifactWithOwnerApproval(2024, 2, "owner-1", "owner-1", approvalAt);
    expect(active).toMatchObject({ outcome: "not_eligible", archivedAt: null });
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "retained", archivedAt: null, retiredAt: null });

    await markMonthlyReportArtifactsEligibleForArchive(approvalAt, 24, "owner-1");
    objects.delete(artifactRows[0].pdfKey);
    const failed = await archiveMonthlyReportArtifactWithOwnerApproval(2024, 2, "owner-1", "owner-1", approvalAt);
    expect(failed.outcome).toBe("integrity_failed");
    expect(failed.availability.map((item) => item.status)).toEqual(["available", "available", "missing"]);
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "eligible_for_archive", archivedAt: null, retiredAt: null, archiveReason: null });
    expect(lifecycleEvents.filter((event) => event.source === "owner_archive_action")).toEqual([]);

    await expect(archiveMonthlyReportArtifactWithOwnerApproval(2024, 2, "other-workspace", "other-workspace", approvalAt)).rejects.toThrow("not authorized");
  });

  it("rejects a checksum-corrupt eligible bundle without revoking or mutating its lifecycle metadata", async () => {
    await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 3, generatedAt: "2024-04-01T00:15:00.000Z" }));
    const approvalAt = new Date("2026-04-02T00:00:00.000Z");
    await markMonthlyReportArtifactsEligibleForArchive(approvalAt, 24, "owner-1");
    objects.set(artifactRows[0].csvKey, Buffer.from("checksum-tampered"));

    const corrupt = await archiveMonthlyReportArtifactWithOwnerApproval(2024, 3, "owner-1", "owner-1", approvalAt);

    expect(corrupt.outcome).toBe("integrity_failed");
    expect(corrupt.availability.map((item) => item.status)).toEqual(["corrupt", "available", "available"]);
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "eligible_for_archive", archivedAt: null, retiredAt: null, archiveReason: null });
    expect(lifecycleEvents.filter((event) => event.source === "owner_archive_action")).toEqual([]);
  });

  it("makes repeated and concurrent approvals deterministic: one archive event, one winner, then already_archived", async () => {
    await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 3, generatedAt: "2024-04-01T00:15:00.000Z" }));
    const approvalAt = new Date("2026-04-02T00:00:00.000Z");
    await markMonthlyReportArtifactsEligibleForArchive(approvalAt, 24, "owner-1");

    const outcomes = await Promise.all([
      archiveMonthlyReportArtifactWithOwnerApproval(2024, 3, "owner-1", "owner-1", approvalAt),
      archiveMonthlyReportArtifactWithOwnerApproval(2024, 3, "owner-1", "owner-1", approvalAt),
    ]);
    expect(outcomes.map((result) => result.outcome).sort()).toEqual(["already_archived", "archived"]);
    const repeated = await archiveMonthlyReportArtifactWithOwnerApproval(2024, 3, "owner-1", "owner-1", approvalAt);
    expect(repeated).toMatchObject({ outcome: "already_archived", archivedAt: approvalAt });
    expect(lifecycleEvents.filter((event) => event.lifecycleStatus === "archived" && event.source === "owner_archive_action")).toHaveLength(1);
    expect(artifactRows[0]).toMatchObject({ lifecycleStatus: "archived", archiveReason: "owner_approved_archive" });
  });

  it("exports only the requested owner-scoped archived PDF audit snapshot with deterministic archive metadata and no storage read", async () => {
    const persisted = await persistMonthlyReportArtifacts(generatedReport({ year: 2024, month: 1, generatedAt: "2024-02-01T00:15:00.000Z" }));
    const approvalAt = new Date("2026-02-02T00:00:00.000Z");
    await markMonthlyReportArtifactsEligibleForArchive(approvalAt, 24, "owner-1");
    await archiveMonthlyReportArtifactWithOwnerApproval(2024, 1, "owner-1", "owner-1", approvalAt);
    storageGetBytes.mockClear();

    const audit = await getMonthlyReportArtifactGovernanceAuditExport("owner-1", {
      year: 2024,
      month: 1,
      lifecycleStatus: "archived",
      artifactFormat: "pdf",
      artifactScope: "archived_or_retired",
    }, new Date("2026-02-03T00:00:00.000Z"));

    expect(audit).toMatchObject({
      kind: "storeos_governance_lifecycle_audit",
      version: 1,
      timezone: "Asia/Jakarta",
      generatedAt: new Date("2026-02-03T00:00:00.000Z"),
      filters: { year: 2024, month: 1, lifecycleStatus: "archived", artifactFormat: "pdf", artifactScope: "archived_or_retired" },
      recordCount: 1,
    });
    expect(audit.records[0]).toMatchObject({
      reportPeriod: { year: 2024, month: 1, timezone: "Asia/Jakarta" },
      lifecycleStatus: "archived",
      occurredAt: approvalAt,
      source: "owner_archive_action",
      actor: "owner-1",
      transitionReason: "owner_approved_archive",
      artifactFormat: "pdf",
      bytes: persisted.artifact.pdf.bytes,
      sha256: persisted.artifact.pdf.sha256,
      integritySnapshotStatus: "recorded",
      artifactScope: "archived",
      currentLifecycleStatus: "archived",
      archiveEligibleAt: approvalAt,
      archivedAt: approvalAt,
      retiredAt: approvalAt,
      archiveReason: "owner_approved_archive",
    });
    expect(JSON.stringify(audit)).not.toContain("monthly-management-reports/");
    expect(storageGetBytes).not.toHaveBeenCalled();
    expect(artifactRows[0].csvSha256).toBe(persisted.artifact.csv.sha256);
  });

  it("filters audit records by active scope, lifecycle, period, and snapshot format while preserving deterministic reverse chronology", async () => {
    await persistMonthlyReportArtifacts(generatedReport({ year: 2025, month: 12, generatedAt: "2026-01-01T00:15:00.000Z" }));

    const csvAudit = await getMonthlyReportArtifactGovernanceAuditExport("owner-1", { artifactScope: "active", artifactFormat: "csv" }, new Date("2026-02-03T00:00:00.000Z"));
    expect(csvAudit.recordCount).toBe(3);
    expect(csvAudit.records.every((record) => record.artifactScope === "active" && record.artifactFormat === "csv")).toBe(true);
    expect(csvAudit.records.map((record) => record.lifecycleStatus)).toEqual(["retained", "verified", "generated"]);

    const retainedDecember = await getMonthlyReportArtifactGovernanceAuditExport("owner-1", { year: 2025, month: 12, lifecycleStatus: "retained", artifactFormat: "html" });
    expect(retainedDecember.records).toHaveLength(1);
    expect(retainedDecember.records[0]).toMatchObject({ lifecycleStatus: "retained", artifactFormat: "html", artifactScope: "active", reportPeriod: { year: 2025, month: 12 } });
    await expect(getMonthlyReportArtifactGovernanceAuditExport("other-workspace")).rejects.toThrow("not authorized");
  });
});
