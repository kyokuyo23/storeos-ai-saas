import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGovernanceAuditQrRevocation, listGovernanceAuditQrExpiryPolicyHistory, listIssuedGovernanceAuditVerificationReceipts } = vi.hoisted(() => ({
  getGovernanceAuditQrRevocation: vi.fn(),
  listGovernanceAuditQrExpiryPolicyHistory: vi.fn(),
  listIssuedGovernanceAuditVerificationReceipts: vi.fn(),
}));

vi.mock("./db", () => ({ getGovernanceAuditQrRevocation, listGovernanceAuditQrExpiryPolicyHistory }));
vi.mock("./governanceAuditVerificationReceipts", () => ({ listIssuedGovernanceAuditVerificationReceipts }));

import {
  generateGovernanceAuditQrPolicyReceiptAuditArtifact,
  getGovernanceAuditQrPolicyReceiptAuditExport,
  verifyGovernanceAuditQrPolicyReceiptAuditBytes,
} from "./governanceAuditQrPolicyReceiptAuditExport";

const generatedAt = new Date("2026-08-27T01:15:00.000Z");
const receipts = [
  {
    receiptId: "receipt-decrease", receiptFormat: "pdf", receiptSha256: "c".repeat(64), verificationAt: new Date("2026-08-26T18:00:00.000Z"),
    verification: { status: "verified" as const }, qr: { referenceId: `qr_${"c".repeat(32)}`, exportId: "export-c", receiptId: "receipt-decrease", verificationStatus: "verified" as const, issuedAt: new Date("2026-08-26T18:00:00.000Z"), expiresAt: new Date("2026-08-26T18:45:00.000Z") },
    export: { exportId: "export-c", format: "pdf" as const, scope: "all" },
    policy: { policyEventId: "qrph_decrease", previousValidityMinutes: 90, validityMinutes: 45, differenceMinutes: -45, change: "decrease" as const },
  },
  {
    receiptId: "receipt-increase", receiptFormat: "csv", receiptSha256: "b".repeat(64), verificationAt: new Date("2026-08-25T18:00:00.000Z"),
    verification: { status: "verified" as const }, qr: { referenceId: `qr_${"b".repeat(32)}`, exportId: "export-b", receiptId: "receipt-increase", verificationStatus: "verified" as const, issuedAt: new Date("2026-08-25T18:00:00.000Z"), expiresAt: new Date("2026-08-25T19:30:00.000Z") },
    export: { exportId: "export-b", format: "csv" as const, scope: "all" },
    policy: { policyEventId: "qrph_increase", previousValidityMinutes: 30, validityMinutes: 90, differenceMinutes: 60, change: "increase" as const },
  },
  {
    receiptId: "receipt-initial", receiptFormat: "csv", receiptSha256: "a".repeat(64), verificationAt: new Date("2026-08-24T18:00:00.000Z"),
    verification: { status: "verified" as const }, qr: { referenceId: `qr_${"a".repeat(32)}`, exportId: "export-a", receiptId: "receipt-initial", verificationStatus: "verified" as const, issuedAt: new Date("2026-08-24T18:00:00.000Z"), expiresAt: new Date("2026-08-24T18:30:00.000Z") },
    export: { exportId: "export-a", format: "csv" as const, scope: "all" },
    policy: { policyEventId: "historical-event-no-longer-present", previousValidityMinutes: null, validityMinutes: 30, differenceMinutes: 0, change: "initial" as const },
  },
  {
    receiptId: "receipt-active", receiptFormat: "csv", receiptSha256: "d".repeat(64), verificationAt: new Date("2026-08-27T01:00:00.000Z"),
    verification: { status: "verified" as const }, qr: { referenceId: `qr_${"d".repeat(32)}`, exportId: "export-d", receiptId: "receipt-active", verificationStatus: "verified" as const, issuedAt: new Date("2026-08-27T01:00:00.000Z"), expiresAt: new Date("2026-08-27T02:00:00.000Z") },
    export: { exportId: "export-d", format: "csv" as const, scope: "all" },
    policy: { policyEventId: "qrph_increase", previousValidityMinutes: 30, validityMinutes: 90, differenceMinutes: 60, change: "increase" as const },
  },
  {
    receiptId: "receipt-revoked", receiptFormat: "pdf", receiptSha256: "e".repeat(64), verificationAt: new Date("2026-08-27T00:30:00.000Z"),
    verification: { status: "verified" as const }, qr: { referenceId: `qr_${"e".repeat(32)}`, exportId: "export-e", receiptId: "receipt-revoked", verificationStatus: "verified" as const, issuedAt: new Date("2026-08-27T00:30:00.000Z"), expiresAt: new Date("2026-08-27T02:00:00.000Z") },
    export: { exportId: "export-e", format: "pdf" as const, scope: "all" },
    policy: { policyEventId: "qrph_decrease", previousValidityMinutes: 90, validityMinutes: 45, differenceMinutes: -45, change: "decrease" as const },
  },
  {
    receiptId: "receipt-invalid", receiptFormat: "csv", receiptSha256: "f".repeat(64), verificationAt: new Date("2026-08-26T00:30:00.000Z"),
    verification: { status: "verified" as const }, qr: { referenceId: "qr_invalid", exportId: "export-f", receiptId: "wrong-receipt", verificationStatus: "verified" as const, issuedAt: new Date("2026-08-26T00:30:00.000Z"), expiresAt: new Date("2026-08-26T01:30:00.000Z") },
    export: { exportId: "export-f", format: "csv" as const, scope: "all" },
    policy: { policyEventId: "qrph_increase", previousValidityMinutes: 30, validityMinutes: 90, differenceMinutes: 60, change: "increase" as const },
  },
];

const history = [
  { id: 2, eventId: "qrph_decrease", ownerOpenId: "owner-1", previousValidityMinutes: 90, newValidityMinutes: 45, resultingValidityMinutes: 45, changedAt: new Date("2026-08-26T17:30:00.000Z"), actorOpenId: "admin-café" },
  { id: 1, eventId: "qrph_increase", ownerOpenId: "owner-1", previousValidityMinutes: 30, newValidityMinutes: 90, resultingValidityMinutes: 90, changedAt: new Date("2026-08-25T17:30:00.000Z"), actorOpenId: "admin-a" },
];

describe("Phase 2.16 combined QR policy and receipt audit export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGovernanceAuditQrExpiryPolicyHistory.mockResolvedValue(history);
    listIssuedGovernanceAuditVerificationReceipts.mockReturnValue(receipts);
    getGovernanceAuditQrRevocation.mockImplementation(async (_ownerOpenId: string, referenceId: string) => referenceId === `qr_${"e".repeat(32)}` ? { referenceId } : null);
  });

  it("correlates each issued receipt only to its stored policy event and labels unmatched history as initial without reconstruction", async () => {
    const audit = await getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", {}, generatedAt);
    expect(listGovernanceAuditQrExpiryPolicyHistory).toHaveBeenCalledWith("owner-1");
    expect(listIssuedGovernanceAuditVerificationReceipts).toHaveBeenCalledWith("owner-1");
    expect(audit).toMatchObject({ generatedAt, timezone: "Asia/Jakarta", recordCount: 6, filters: { dateBoundary: "start_inclusive_end_exclusive_wib" } });
    expect(audit.records.map((record) => record.receiptId)).toEqual(["receipt-active", "receipt-revoked", "receipt-decrease", "receipt-invalid", "receipt-increase", "receipt-initial"]);
    expect(audit.records[2]).toMatchObject({ policyEventId: "qrph_decrease", policyDirection: "decrease", policyActorOpenId: "admin-café", policyChangedAt: history[0].changedAt, policyCorrelation: "matched_policy_event", policyDifferenceMinutes: -45, qrStatus: "expired" });
    expect(audit.records[5]).toMatchObject({ policyEventId: null, policyPreviousValidityMinutes: null, policyValidityMinutes: 30, policyDirection: "initial", policyCorrelation: "initial_policy", policyChangedAt: null, policyLabel: "Initial policy — no previous policy.", qrStatus: "expired" });
  });

  it("filters with inclusive/exclusive Jakarta boundaries and direction, actor, verified status, receipt format, and fixed scope", async () => {
    const audit = await getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", {
      startDate: "2026-08-26", endDate: "2026-08-27", direction: "decrease", actorOpenId: "admin-café", verificationStatus: "verified", qrStatus: "expired", receiptFormat: "pdf", scope: "governance_audit_qr_policy_receipt",
    }, generatedAt);
    expect(audit.recordCount).toBe(1);
    expect(audit.records[0]).toMatchObject({ receiptId: "receipt-decrease", policyDirection: "decrease", policyActorOpenId: "admin-café", receiptFormat: "pdf" });
    await expect(getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { startDate: "2026-02-30" })).rejects.toThrow("Tanggal mulai");
  });

  it("derives active, expired, revoked, and invalid QR status read-only before applying the server-side QR filter", async () => {
    const audit = await getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", {}, generatedAt);
    expect(audit.records.map((record) => [record.receiptId, record.qrStatus])).toEqual(expect.arrayContaining([
      ["receipt-active", "active"], ["receipt-revoked", "revoked"], ["receipt-decrease", "expired"], ["receipt-invalid", "invalid"],
    ]));
    const revoked = await getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { qrStatus: "revoked" }, generatedAt);
    expect(revoked.records).toHaveLength(1);
    expect(revoked.records[0]).toMatchObject({ receiptId: "receipt-revoked", qrStatus: "revoked" });
    expect(getGovernanceAuditQrRevocation).toHaveBeenCalledWith("owner-1", `qr_${"e".repeat(32)}`);
  });

  it("applies the same server-side preset and literal receipt, export, policy, actor, or opaque QR searches deterministically", async () => {
    const byPreset = await getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { datePreset: "last_7_days", searchTerm: "receipt", scope: "governance_audit_qr_policy_receipt" }, generatedAt);
    expect(byPreset.filters).toMatchObject({ datePreset: "last_7_days", datePresetLabel: "7 hari terakhir", startDate: "2026-08-21", endDate: "2026-08-27", startWib: "2026-08-21 00:00:00 WIB", endWib: "2026-08-28 00:00:00 WIB", searchTerm: "receipt" });
    expect(byPreset.records.map((record) => record.receiptId)).toEqual(["receipt-active", "receipt-revoked", "receipt-decrease", "receipt-invalid", "receipt-increase", "receipt-initial"]);
    await expect(getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { searchTerm: "receipt-decrease" })).resolves.toMatchObject({ recordCount: 1, records: [expect.objectContaining({ receiptId: "receipt-decrease" })] });
    await expect(getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { searchTerm: "export-b" })).resolves.toMatchObject({ recordCount: 1, records: [expect.objectContaining({ receiptId: "receipt-increase" })] });
    await expect(getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { searchTerm: "qrph_decrease" })).resolves.toMatchObject({ recordCount: 2 });
    await expect(getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { searchTerm: "admin-café" })).resolves.toMatchObject({ recordCount: 2, records: expect.arrayContaining([expect.objectContaining({ receiptId: "receipt-decrease" })]) });
    await expect(getGovernanceAuditQrPolicyReceiptAuditExport("owner-1", { searchTerm: "cccccccc" })).resolves.toMatchObject({ records: [expect.objectContaining({ receiptId: "receipt-decrease" })] });
  });

  it("generates BOM CSV exact bytes with audit scope and Unicode actor context", async () => {
    const artifact = await generateGovernanceAuditQrPolicyReceiptAuditArtifact("owner-1", { scope: "governance_audit_qr_policy_receipt" }, "csv", generatedAt);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");
    const text = bytes.toString("utf8");
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(text).toContain('"StoreOS Combined QR Policy & Receipt Audit Export"');
    expect(text).toContain('"admin-café"');
    expect(text).toContain('"Initial policy — no previous policy."');
    expect(text).toContain('"Policy changedAt (WIB)"');
    expect(text).toContain('"Status QR"');
    expect(artifact).toMatchObject({ format: "csv", generatedAt, recordCount: 6, byteSize: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), exportId: `storeos-qr-policy-receipt-audit-csv-${createHash("sha256").update(bytes).digest("hex")}` });
  });

  it("generates real PDF bytes and reports only verified or explicit tamper mismatch without regenerating records", async () => {
    const artifact = await generateGovernanceAuditQrPolicyReceiptAuditArtifact("owner-1", {}, "pdf", generatedAt);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(verifyGovernanceAuditQrPolicyReceiptAuditBytes(artifact.exportId, artifact.bytesBase64)).toMatchObject({ verified: true, status: "verified", byteSize: artifact.byteSize, expectedSha256: artifact.sha256 });
    bytes[bytes.byteLength - 2] ^= 0x01;
    expect(verifyGovernanceAuditQrPolicyReceiptAuditBytes(artifact.exportId, bytes.toString("base64"))).toMatchObject({ verified: false, status: "hash_mismatch", expectedSha256: artifact.sha256 });
    expect(listGovernanceAuditQrExpiryPolicyHistory).toHaveBeenCalledTimes(1);
    expect(listIssuedGovernanceAuditVerificationReceipts).toHaveBeenCalledTimes(1);
  });
});
