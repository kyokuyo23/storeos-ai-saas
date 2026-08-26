import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGeneratedGovernanceAuditExportForOwner, verifyGovernanceAuditExportBytes } = vi.hoisted(() => ({
  getGeneratedGovernanceAuditExportForOwner: vi.fn(),
  verifyGovernanceAuditExportBytes: vi.fn(),
}));

vi.mock("./governanceAuditExportIntegrity", () => ({
  getGeneratedGovernanceAuditExportForOwner,
  verifyGovernanceAuditExportBytes,
}));

import {
  createGovernanceAuditVerificationQr,
  resolveGovernanceAuditVerificationQr,
  revokeGovernanceAuditVerificationQrReference,
} from "./governanceAuditVerificationQr";

const issuedAt = new Date("2026-08-26T01:20:00.000Z");
const artifact = {
  exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`,
  format: "csv" as const,
  scope: "periode 2024-01 · status archived",
  generatedAt: new Date("2026-08-26T01:15:00.000Z"),
  byteSize: 123,
  sha256: "b".repeat(64),
  bytesBase64: Buffer.from("\ufeffAudit Governance,Unicode café", "utf8").toString("base64"),
};

describe("Phase 2.10 governance audit verification QR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGeneratedGovernanceAuditExportForOwner.mockReturnValue(artifact);
    verifyGovernanceAuditExportBytes.mockReturnValue({ verified: true, actualSha256: artifact.sha256, byteSize: artifact.byteSize });
  });

  it("issues a deterministic, non-sensitive QR payload for a verified export reference", async () => {
    const first = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}`, issuedAt);
    const second = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}`, issuedAt);

    expect(first.referenceId).toMatch(/^qr_[a-f0-9]{32}$/);
    expect(second.referenceId).toBe(first.referenceId);
    expect(first.payload).toBe(JSON.stringify({ version: 1, referenceId: first.referenceId, exportId: artifact.exportId, receiptId: `storeos-governance-audit-receipt-${artifact.exportId}`, verificationStatus: "verified" }));
    expect(first.payload).not.toContain(artifact.sha256);
    expect(first.payload).not.toContain("owner-1");
    expect(first.payload).not.toContain(artifact.bytesBase64);
    expect(first.imageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.verificationUrl).toContain(`/verify?ref=${first.referenceId}`);
    expect(first.verificationUrl).toContain("status=verified");
  });

  it("recomputes the exact cached export bytes before resolving an owner-scoped QR as verified", async () => {
    const qr = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}`, issuedAt);
    const result = resolveGovernanceAuditVerificationQr("owner-1", { referenceId: qr.referenceId, exportId: artifact.exportId, receiptId: qr.receiptId }, new Date("2026-08-26T01:21:00.000Z"));

    expect(result).toMatchObject({ status: "verified", exportId: artifact.exportId, receiptId: qr.receiptId, sha256: artifact.sha256, byteSize: artifact.byteSize, verificationStatus: "verified" });
    expect(getGeneratedGovernanceAuditExportForOwner).toHaveBeenCalledWith("owner-1", artifact.exportId);
    expect(verifyGovernanceAuditExportBytes).toHaveBeenCalledWith(artifact.exportId, artifact.bytesBase64);
  });

  it("rejects cross-owner, altered, expired, revoked, missing, and mismatched QR references without offering artifact access", async () => {
    const qr = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}`, issuedAt);
    const input = { referenceId: qr.referenceId, exportId: artifact.exportId, receiptId: qr.receiptId };

    expect(resolveGovernanceAuditVerificationQr("owner-2", input, new Date("2026-08-26T01:21:00.000Z"))).toMatchObject({ status: "invalid_reference" });
    expect(resolveGovernanceAuditVerificationQr("owner-1", { ...input, exportId: `${artifact.exportId}-altered` }, new Date("2026-08-26T01:21:00.000Z"))).toMatchObject({ status: "invalid_reference" });
    expect(resolveGovernanceAuditVerificationQr("owner-1", input, new Date(issuedAt.getTime() + 30 * 60 * 1000))).toMatchObject({ status: "expired" });

    const revocable = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-revoked`, issuedAt);
    revokeGovernanceAuditVerificationQrReference(revocable.referenceId);
    expect(resolveGovernanceAuditVerificationQr("owner-1", { referenceId: revocable.referenceId, exportId: artifact.exportId, receiptId: revocable.receiptId }, new Date("2026-08-26T01:21:00.000Z"))).toMatchObject({ status: "revoked" });

    const missing = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-missing`, issuedAt);
    getGeneratedGovernanceAuditExportForOwner.mockReturnValueOnce(null);
    expect(resolveGovernanceAuditVerificationQr("owner-1", { referenceId: missing.referenceId, exportId: artifact.exportId, receiptId: missing.receiptId }, new Date("2026-08-26T01:21:00.000Z"))).toMatchObject({ status: "artifact_missing" });

    const corrupted = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-corrupt`, issuedAt);
    verifyGovernanceAuditExportBytes.mockReturnValueOnce({ verified: false, actualSha256: "c".repeat(64), byteSize: artifact.byteSize });
    expect(resolveGovernanceAuditVerificationQr("owner-1", { referenceId: corrupted.referenceId, exportId: artifact.exportId, receiptId: corrupted.receiptId }, new Date("2026-08-26T01:21:00.000Z"))).toMatchObject({ status: "verification_failed" });
  });
});
