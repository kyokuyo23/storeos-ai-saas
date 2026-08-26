import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMonthlyReportArtifactGovernanceAuditExport } = vi.hoisted(() => ({
  getMonthlyReportArtifactGovernanceAuditExport: vi.fn(),
}));

vi.mock("./monthlyReportArtifacts", () => ({ getMonthlyReportArtifactGovernanceAuditExport }));

import {
  buildGovernanceAuditCsvBytes,
  generateGovernanceAuditExportArtifact,
  verifyGovernanceAuditExportBytes,
} from "./governanceAuditExportIntegrity";

const generatedAt = new Date("2026-08-26T01:15:00.000Z");
const auditFixture = () => ({
  kind: "storeos_governance_lifecycle_audit" as const,
  version: 1 as const,
  generatedAt,
  timezone: "Asia/Jakarta" as const,
  filters: { year: 2024, month: 1, lifecycleStatus: "archived" as const, artifactFormat: "csv" as const, artifactScope: "archived_or_retired" as const },
  recordCount: 1,
  records: [{
    reportPeriod: { year: 2024, month: 1, timezone: "Asia/Jakarta" },
    lifecycleStatus: "archived" as const,
    occurredAt: new Date("2026-08-25T17:15:00.000Z"),
    source: "owner_archive_action",
    actor: "owner-1",
    transitionReason: "Pemeriksaan café — data tidak berubah",
    eventArtifactFormat: "bundle",
    artifactFormat: "bundle" as const,
    bytes: 1234,
    sha256: "b".repeat(64),
    integritySnapshotStatus: "recorded" as const,
    artifactScope: "archived" as const,
    currentLifecycleStatus: "archived" as const,
    archiveEligibleAt: new Date("2026-08-24T17:15:00.000Z"),
    archivedAt: new Date("2026-08-25T17:15:00.000Z"),
    retiredAt: new Date("2026-08-25T17:15:00.000Z"),
    archiveReason: "owner_approved_archive",
  }],
});

describe("Phase 2.8 governance audit export integrity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hashes the exact UTF-8 BOM CSV bytes, including Unicode content, and reports deterministic scope metadata", async () => {
    const audit = auditFixture();
    getMonthlyReportArtifactGovernanceAuditExport.mockResolvedValue(audit);
    const artifact = await generateGovernanceAuditExportArtifact("owner-1", { year: 2024, month: 1, lifecycleStatus: "archived", artifactFormat: "csv", artifactScope: "archived_or_retired" }, "csv", generatedAt);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");

    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(bytes.toString("utf8")).toContain("Pemeriksaan café — data tidak berubah");
    expect(artifact.byteSize).toBe(bytes.byteLength);
    expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(artifact.exportId).toBe(`storeos-governance-audit-csv-${artifact.sha256}`);
    expect(artifact).toMatchObject({ generatedAt, timezone: "Asia/Jakarta", scope: "periode=2024-01; lifecycle=archived; format=csv; status artefak=archived_or_retired", recordCount: 1 });
    expect(getMonthlyReportArtifactGovernanceAuditExport).toHaveBeenCalledWith("owner-1", expect.objectContaining({ year: 2024, month: 1 }), generatedAt);
  });

  it("generates stable exact CSV bytes for identical audit data and never mutates lifecycle input data", async () => {
    const audit = auditFixture();
    const snapshot = JSON.stringify(audit);
    getMonthlyReportArtifactGovernanceAuditExport.mockResolvedValue(audit);
    const first = await generateGovernanceAuditExportArtifact("owner-1", { year: 2024 }, "csv", generatedAt);
    const second = await generateGovernanceAuditExportArtifact("owner-1", { year: 2024 }, "csv", generatedAt);

    expect(first).toMatchObject({ bytesBase64: second.bytesBase64, sha256: second.sha256, exportId: second.exportId });
    expect(buildGovernanceAuditCsvBytes(audit).toString("base64")).toBe(first.bytesBase64);
    expect(JSON.stringify(audit)).toBe(snapshot);
  });

  it("hashes the exact server-produced PDF bytes and keeps its byte size consistent", async () => {
    getMonthlyReportArtifactGovernanceAuditExport.mockResolvedValue(auditFixture());
    const artifact = await generateGovernanceAuditExportArtifact("owner-1", { year: 2024 }, "pdf", generatedAt);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");

    expect(artifact.format).toBe("pdf");
    expect(artifact.filename).toMatch(/\.pdf$/);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(artifact.byteSize).toBe(bytes.byteLength);
    expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("verifies exact bytes and explicitly reports tampered or malformed export content", async () => {
    getMonthlyReportArtifactGovernanceAuditExport.mockResolvedValue(auditFixture());
    const artifact = await generateGovernanceAuditExportArtifact("owner-1", { year: 2024 }, "csv", generatedAt);
    expect(verifyGovernanceAuditExportBytes(artifact.exportId, artifact.bytesBase64)).toMatchObject({ verified: true, status: "verified", byteSize: artifact.byteSize, expectedSha256: artifact.sha256, actualSha256: artifact.sha256 });

    const tampered = Buffer.from(artifact.bytesBase64, "base64");
    tampered[tampered.byteLength - 2] ^= 0x01;
    const mismatch = verifyGovernanceAuditExportBytes(artifact.exportId, tampered.toString("base64"));
    expect(mismatch).toMatchObject({ verified: false, status: "hash_mismatch", expectedSha256: artifact.sha256 });
    expect(mismatch.actualSha256).not.toBe(artifact.sha256);
    expect(() => verifyGovernanceAuditExportBytes(artifact.exportId, "tampered-not-base64")).toThrow("Invalid governance audit export bytes");
  });
});
