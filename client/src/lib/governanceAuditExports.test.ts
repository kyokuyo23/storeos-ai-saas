import { parse } from "csv-parse/sync";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGovernanceAuditCsv, governanceAuditCsvFilename, governanceAuditFilterScope, printGovernanceAudit, type GovernanceAuditExportData } from "./governanceAuditExports";

const audit: GovernanceAuditExportData = {
  kind: "storeos_governance_lifecycle_audit",
  version: 1,
  generatedAt: "2026-08-25T03:15:00.000Z",
  timezone: "Asia/Jakarta",
  filters: { year: 2024, month: 10, lifecycleStatus: "archived", artifactFormat: "pdf", artifactScope: "archived_or_retired" },
  recordCount: 1,
  records: [{
    reportPeriod: { year: 2024, month: 10, timezone: "Asia/Jakarta" },
    lifecycleStatus: "archived",
    occurredAt: "2026-08-25T03:00:00.000Z",
    source: "owner_archive_action",
    actor: "owner-1",
    transitionReason: "owner_approved_archive, checksum tervalidasi",
    eventArtifactFormat: "bundle",
    artifactFormat: "pdf",
    bytes: 512,
    sha256: "a".repeat(64),
    integritySnapshotStatus: "recorded",
    artifactScope: "archived",
    currentLifecycleStatus: "archived",
    archiveEligibleAt: "2026-08-24T03:00:00.000Z",
    archivedAt: "2026-08-25T03:00:00.000Z",
    retiredAt: "2026-08-25T03:00:00.000Z",
    archiveReason: "owner_approved_archive",
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe("governance audit export", () => {
  it("produces a UTF-8 BOM CSV with strict parseable columns, audit filters, and quoted transition metadata", () => {
    const csv = buildGovernanceAuditCsv(audit);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toContain('"owner_approved_archive, checksum tervalidasi"');
    expect(csv).toContain("WIB");
    expect(csv).not.toContain("�");

    const rows = parse(csv, { bom: true, columns: false, relax_column_count: false, skip_empty_lines: false }) as string[][];
    expect(rows.every((row) => row.length === 19)).toBe(true);
    expect(rows[0].slice(0, 2)).toEqual(["StoreOS Governance Lifecycle Audit Export", "v1"]);
    expect(rows.find((row) => row[0] === "Filter tahun")?.[1]).toBe("2024");
    expect(rows.find((row) => row[0] === "Filter status artefak")?.[1]).toBe("archived_or_retired");
    expect(rows.find((row) => row[0] === "Tahun")).toContain("Metadata transisi");
    const record = rows.find((row) => row[0] === "2024" && row[3] === "archived");
    expect(record?.slice(0, 4)).toEqual(["2024", "10", "Asia/Jakarta", "archived"]);
    expect(record?.[9]).toBe("512");
    expect(record?.[18]).toBe("owner_approved_archive, checksum tervalidasi");
  });

  it("uses a stable scope description and filter-specific filename", () => {
    expect(governanceAuditFilterScope(audit)).toBe("periode=2024-10; lifecycle=archived; format=pdf; status artefak=archived_or_retired");
    expect(governanceAuditCsvFilename(audit)).toBe("storeos-governance-audit-2024-10-archived-pdf-archived_or_retired.csv");
  });

  it("enters and leaves the dedicated print/PDF mode around the browser print action", () => {
    const add = vi.fn();
    const remove = vi.fn();
    const print = vi.fn();
    vi.stubGlobal("document", { body: { classList: { add, remove } } });
    vi.stubGlobal("window", { print });

    printGovernanceAudit(audit);

    expect(add).toHaveBeenCalledWith("printing-governance-audit");
    expect(print).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("printing-governance-audit");
  });
});
