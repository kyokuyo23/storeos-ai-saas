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
import {
  GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES,
  GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES,
  GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES,
} from "./governanceAuditQrExpiry";

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

  it("calculates issued and expiry timestamps server-side for default, configured, and maximum policy values", async () => {
    const defaultQr = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-default`, issuedAt);
    const minimumQr = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-minimum`, issuedAt, GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES);
    const configuredQr = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-configured`, issuedAt, 90);
    const maximumQr = await createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-maximum`, issuedAt, GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES);

    expect(defaultQr).toMatchObject({ issuedAt, expiresAt: new Date(issuedAt.getTime() + GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES * 60_000) });
    expect(minimumQr.expiresAt).toEqual(new Date(issuedAt.getTime() + 5 * 60_000));
    expect(configuredQr.expiresAt).toEqual(new Date(issuedAt.getTime() + 90 * 60_000));
    expect(maximumQr.expiresAt).toEqual(new Date(issuedAt.getTime() + 10_080 * 60_000));

    const validBeforeBoundary = resolveGovernanceAuditVerificationQr("owner-1", { referenceId: minimumQr.referenceId, exportId: artifact.exportId, receiptId: minimumQr.receiptId }, new Date(minimumQr.expiresAt.getTime() - 1));
    expect(validBeforeBoundary).toMatchObject({ status: "verified", issuedAt, expiresAt: minimumQr.expiresAt });
    const expiredAtBoundary = resolveGovernanceAuditVerificationQr("owner-1", { referenceId: minimumQr.referenceId, exportId: artifact.exportId, receiptId: minimumQr.receiptId }, minimumQr.expiresAt);
    expect(expiredAtBoundary).toMatchObject({ status: "expired", issuedAt, expiresAt: minimumQr.expiresAt });
  });

  it("does not mutate the originally issued QR object when a later reissue applies a new policy", async () => {
    const receiptId = `storeos-governance-audit-receipt-${artifact.exportId}-reissued`;
    const first = await createGovernanceAuditVerificationQr("owner-1", artifact, receiptId, issuedAt, 5);
    const firstExpiry = new Date(first.expiresAt);
    const reissued = await createGovernanceAuditVerificationQr("owner-1", artifact, receiptId, issuedAt, 90);

    expect(first.expiresAt).toEqual(firstExpiry);
    expect(reissued.referenceId).toBe(first.referenceId);
    expect(reissued.expiresAt).toEqual(new Date(issuedAt.getTime() + 90 * 60_000));
  });

  it("refuses malformed, sub-minimum, and over-maximum policy values before storing a reference", async () => {
    await expect(createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-invalid-low`, issuedAt, 4)).rejects.toThrow("Masa berlaku QR tidak valid");
    await expect(createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-invalid-decimal`, issuedAt, 30.5)).rejects.toThrow("Masa berlaku QR tidak valid");
    await expect(createGovernanceAuditVerificationQr("owner-1", artifact, `storeos-governance-audit-receipt-${artifact.exportId}-invalid-high`, issuedAt, 10_081)).rejects.toThrow("Masa berlaku QR tidak valid");
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
    expect(resolveGovernanceAuditVerificationQr("owner-1", input, new Date(issuedAt.getTime() + 30 * 60 * 1000))).toMatchObject({ status: "expired", issuedAt, expiresAt: new Date(issuedAt.getTime() + 30 * 60 * 1000) });

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
