import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMonthlyReportArtifactGovernanceAuditExport } = vi.hoisted(() => ({
  getMonthlyReportArtifactGovernanceAuditExport: vi.fn(),
}));

vi.mock("./monthlyReportArtifacts", () => ({ getMonthlyReportArtifactGovernanceAuditExport }));

import { generateGovernanceAuditExportArtifact, registerGeneratedGovernanceAuditExport } from "./governanceAuditExportIntegrity";
import { deriveGovernanceAuditQrReceiptPolicyContext } from "./governanceAuditQrExpiry";
import { issueGovernanceAuditVerificationReceipt } from "./governanceAuditVerificationReceipts";

const generatedAt = new Date("2026-08-26T01:15:00.000Z");
const verificationAt = new Date("2026-08-26T01:20:00.000Z");

function auditFixture() {
  return {
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
  };
}

async function registeredExport(ownerOpenId = "owner-1") {
  const audit = auditFixture();
  getMonthlyReportArtifactGovernanceAuditExport.mockResolvedValue(audit);
  const artifact = await generateGovernanceAuditExportArtifact(ownerOpenId, { year: 2024, month: 1, lifecycleStatus: "archived", artifactFormat: "csv", artifactScope: "archived_or_retired" }, "csv", generatedAt);
  registerGeneratedGovernanceAuditExport(ownerOpenId, artifact);
  return { artifact, audit };
}

describe("Phase 2.9 governance audit verification receipts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues a deterministic BOM CSV receipt only for the exact verified bytes and includes WIB, scope, size, hashes, QR expiry, and initial policy context", async () => {
    const { artifact, audit } = await registeredExport();
    const snapshot = JSON.stringify(audit);
    const result = await issueGovernanceAuditVerificationReceipt("owner-1", { exportId: artifact.exportId, bytesBase64: artifact.bytesBase64, receiptFormat: "csv", qrValidityMinutes: 90 }, verificationAt);

    expect(result.status).toBe("issued");
    if (result.status !== "issued") throw new Error("Expected receipt issuance");
    const bytes = Buffer.from(result.receipt.bytesBase64, "base64");
    const text = bytes.toString("utf8");
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(text).toContain(artifact.exportId);
    expect(text).toContain(artifact.scope);
    expect(text).toContain(artifact.sha256);
    expect(text).toContain("QR issuedAt (Asia/Jakarta)");
    expect(text).toContain("QR expiresAt (Asia/Jakarta)");
    expect(text).toContain("Masa berlaku QR (menit)");
    expect(text).toContain("Initial policy — no previous policy.");
    expect(result.receipt).toMatchObject({
      receiptId: `storeos-governance-audit-receipt-${artifact.exportId}`,
      receiptFormat: "csv",
      verificationAt,
      export: { exportId: artifact.exportId, byteSize: artifact.byteSize, sha256: artifact.sha256, scope: artifact.scope, timezone: "Asia/Jakarta" },
      verification: { verified: true, status: "verified", actualSha256: artifact.sha256 },
      qr: { issuedAt: verificationAt, expiresAt: new Date(verificationAt.getTime() + 90 * 60_000) },
      policy: {
        validityMinutes: 90,
        policyEventId: null,
        previousValidityMinutes: null,
        change: "initial",
        differenceMinutes: 0,
        issuedAt: verificationAt,
        expiresAt: new Date(verificationAt.getTime() + 90 * 60_000),
      },
    });
    expect(result.receipt.receiptByteSize).toBe(bytes.byteLength);
    expect(result.receipt.receiptSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(JSON.stringify(audit)).toBe(snapshot);
  });

  it("issues a PDF receipt from the verified export context with exact receipt-byte and QR expiry metadata", async () => {
    const { artifact } = await registeredExport();
    const result = await issueGovernanceAuditVerificationReceipt("owner-1", { exportId: artifact.exportId, bytesBase64: artifact.bytesBase64, receiptFormat: "pdf", qrValidityMinutes: 90 }, verificationAt);

    expect(result.status).toBe("issued");
    if (result.status !== "issued") throw new Error("Expected receipt issuance");
    const bytes = Buffer.from(result.receipt.bytesBase64, "base64");
    expect(result.receipt).toMatchObject({ receiptFormat: "pdf", contentType: "application/pdf", export: { exportId: artifact.exportId }, qr: { referenceId: expect.stringMatching(/^qr_[a-f0-9]{32}$/), issuedAt: verificationAt, expiresAt: new Date(verificationAt.getTime() + 90 * 60_000) } });
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.receipt.receiptByteSize).toBe(bytes.byteLength);
    expect(result.receipt.receiptSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("records initial, increase, decrease, and sequential policy diff context on only newly issued receipts without mutating prior QR expiry", async () => {
    const { artifact } = await registeredExport();
    const initial = await issueGovernanceAuditVerificationReceipt("owner-1", {
      exportId: artifact.exportId,
      bytesBase64: artifact.bytesBase64,
      receiptFormat: "csv",
      qrValidityMinutes: 30,
      qrPolicyContext: deriveGovernanceAuditQrReceiptPolicyContext(30),
    }, verificationAt);
    const increased = await issueGovernanceAuditVerificationReceipt("owner-1", {
      exportId: artifact.exportId,
      bytesBase64: artifact.bytesBase64,
      receiptFormat: "csv",
      qrValidityMinutes: 90,
      qrPolicyContext: deriveGovernanceAuditQrReceiptPolicyContext(90, [{ eventId: "qrph_increase", previousValidityMinutes: 30, resultingValidityMinutes: 90 }]),
    }, new Date("2026-08-26T02:20:00.000Z"));
    const decreased = await issueGovernanceAuditVerificationReceipt("owner-1", {
      exportId: artifact.exportId,
      bytesBase64: artifact.bytesBase64,
      receiptFormat: "pdf",
      qrValidityMinutes: 45,
      qrPolicyContext: deriveGovernanceAuditQrReceiptPolicyContext(45, [
        { eventId: "qrph_decrease", previousValidityMinutes: 90, resultingValidityMinutes: 45 },
        { eventId: "qrph_increase", previousValidityMinutes: 30, resultingValidityMinutes: 90 },
      ]),
    }, new Date("2026-08-26T03:20:00.000Z"));
    if (initial.status !== "issued" || increased.status !== "issued" || decreased.status !== "issued") throw new Error("Expected all receipt issuances");

    expect(initial.receipt.policy).toMatchObject({ change: "initial", previousValidityMinutes: null, differenceMinutes: 0, policyEventId: null });
    expect(increased.receipt.policy).toMatchObject({ change: "increase", previousValidityMinutes: 30, validityMinutes: 90, differenceMinutes: 60, policyEventId: "qrph_increase" });
    expect(decreased.receipt.policy).toMatchObject({ change: "decrease", previousValidityMinutes: 90, validityMinutes: 45, differenceMinutes: -45, policyEventId: "qrph_decrease" });
    expect(initial.receipt.qr.expiresAt).toEqual(new Date(verificationAt.getTime() + 30 * 60_000));
    expect(increased.receipt.qr.expiresAt).toEqual(new Date("2026-08-26T03:50:00.000Z"));
    expect(Buffer.from(decreased.receipt.bytesBase64, "base64").toString("latin1")).toContain("Masa berlaku QR");
  });

  it("refuses receipts for tampered bytes, missing export context, and a different owner scope without mutating lifecycle data", async () => {
    const { artifact, audit } = await registeredExport();
    const snapshot = JSON.stringify(audit);
    const tampered = Buffer.from(artifact.bytesBase64, "base64");
    tampered[tampered.byteLength - 1] ^= 0x01;

    const mismatch = await issueGovernanceAuditVerificationReceipt("owner-1", { exportId: artifact.exportId, bytesBase64: tampered.toString("base64"), receiptFormat: "csv" }, verificationAt);
    expect(mismatch).toMatchObject({ status: "verification_failed", expectedSha256: artifact.sha256 });
    expect(mismatch.status === "verification_failed" && mismatch.actualSha256).not.toBe(artifact.sha256);
    await expect(issueGovernanceAuditVerificationReceipt("other-owner", { exportId: artifact.exportId, bytesBase64: artifact.bytesBase64, receiptFormat: "csv" }, verificationAt)).resolves.toMatchObject({ status: "export_not_available" });
    await expect(issueGovernanceAuditVerificationReceipt("owner-1", { exportId: "storeos-governance-audit-csv-" + "f".repeat(64), bytesBase64: artifact.bytesBase64, receiptFormat: "csv" }, verificationAt)).resolves.toMatchObject({ status: "export_not_available" });
    expect(JSON.stringify(audit)).toBe(snapshot);
  });
});
