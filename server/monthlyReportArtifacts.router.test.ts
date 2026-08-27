import { beforeEach, describe, expect, it, vi } from "vitest";

const { archiveMonthlyReportArtifactWithOwnerApproval, getMonthlyReportArtifactGovernanceAuditExport, getMonthlyReportArtifactGovernanceSummary, getMonthlyReportArtifactLifecycleHistory, listMonthlyReportArtifacts } = vi.hoisted(() => ({
  archiveMonthlyReportArtifactWithOwnerApproval: vi.fn(async () => ({ outcome: "archived", artifact: { id: 7, year: 2024, month: 1, lifecycleStatus: "archived" }, availability: [], archivedAt: new Date("2026-02-02T00:00:00.000Z") })),
  getMonthlyReportArtifactGovernanceAuditExport: vi.fn(async () => ({ kind: "storeos_governance_lifecycle_audit", version: 1, recordCount: 0, records: [] })),
  listMonthlyReportArtifacts: vi.fn(async () => []),
  getMonthlyReportArtifactGovernanceSummary: vi.fn(async () => ({ retainedArtifactCount: 0 })),
  getMonthlyReportArtifactLifecycleHistory: vi.fn(async () => null),
}));
const { generateGovernanceAuditExportArtifact, registerGeneratedGovernanceAuditExport, verifyGovernanceAuditExportBytes } = vi.hoisted(() => ({
  generateGovernanceAuditExportArtifact: vi.fn(async () => ({ exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, format: "csv", byteSize: 12, sha256: "a".repeat(64), bytesBase64: "77u/" })),
  registerGeneratedGovernanceAuditExport: vi.fn(),
  verifyGovernanceAuditExportBytes: vi.fn(() => ({ verified: true, status: "verified", byteSize: 3 })),
}));
const { issueGovernanceAuditVerificationReceipt } = vi.hoisted(() => ({
  issueGovernanceAuditVerificationReceipt: vi.fn(() => ({ status: "issued", receipt: { receiptId: "storeos-governance-audit-receipt-test", receiptFormat: "csv", filename: "receipt.csv", contentType: "text/csv;charset=utf-8", receiptByteSize: 12, receiptSha256: "b".repeat(64), bytesBase64: "77u/" } })),
}));
const { getGovernanceAuditVerificationQrReference, resolveGovernanceAuditVerificationQr, revokeGovernanceAuditVerificationQrReference } = vi.hoisted(() => ({
  getGovernanceAuditVerificationQrReference: vi.fn(),
  resolveGovernanceAuditVerificationQr: vi.fn(() => ({ status: "verified", exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, verificationStatus: "verified" })),
  revokeGovernanceAuditVerificationQrReference: vi.fn(),
}));
const { generateGovernanceAuditQrPolicyAuditArtifact, getGovernanceAuditQrPolicyAuditExport, verifyGovernanceAuditQrPolicyAuditBytes } = vi.hoisted(() => ({
  generateGovernanceAuditQrPolicyAuditArtifact: vi.fn(),
  getGovernanceAuditQrPolicyAuditExport: vi.fn(),
  verifyGovernanceAuditQrPolicyAuditBytes: vi.fn(),
}));
const { generateGovernanceAuditQrPolicyReceiptAuditArtifact, getGovernanceAuditQrPolicyReceiptAuditExport, verifyGovernanceAuditQrPolicyReceiptAuditBytes } = vi.hoisted(() => ({
  generateGovernanceAuditQrPolicyReceiptAuditArtifact: vi.fn(),
  getGovernanceAuditQrPolicyReceiptAuditExport: vi.fn(),
  verifyGovernanceAuditQrPolicyReceiptAuditBytes: vi.fn(),
}));
const { getGovernanceAuditQrExpiryPolicy, getGovernanceAuditQrRevocation, listGovernanceAuditQrExpiryPolicyHistory, revokeGovernanceAuditQrReference, updateGovernanceAuditQrExpiryPolicy } = vi.hoisted(() => ({
  getGovernanceAuditQrExpiryPolicy: vi.fn(),
  getGovernanceAuditQrRevocation: vi.fn(),
  listGovernanceAuditQrExpiryPolicyHistory: vi.fn(),
  revokeGovernanceAuditQrReference: vi.fn(),
  updateGovernanceAuditQrExpiryPolicy: vi.fn(),
}));
vi.mock("./monthlyReportArtifacts", () => ({
  archiveMonthlyReportArtifactWithOwnerApproval,
  canAccessMonthlyReportArtifacts: (user: { openId: string; role: string } | null) => user?.openId === "owner-1" && user.role === "admin",
  getMonthlyReportArtifactGovernanceAuditExport,
  getMonthlyReportArtifactGovernanceSummary,
  getMonthlyReportArtifactLifecycleHistory,
  listMonthlyReportArtifacts,
}));
vi.mock("./governanceAuditExportIntegrity", () => ({ generateGovernanceAuditExportArtifact, registerGeneratedGovernanceAuditExport, verifyGovernanceAuditExportBytes }));
vi.mock("./governanceAuditVerificationReceipts", () => ({ issueGovernanceAuditVerificationReceipt }));
vi.mock("./governanceAuditVerificationQr", () => ({ getGovernanceAuditVerificationQrReference, resolveGovernanceAuditVerificationQr, revokeGovernanceAuditVerificationQrReference }));
vi.mock("./governanceAuditQrPolicyAuditExport", () => ({ generateGovernanceAuditQrPolicyAuditArtifact, getGovernanceAuditQrPolicyAuditExport, verifyGovernanceAuditQrPolicyAuditBytes }));
vi.mock("./governanceAuditQrPolicyReceiptAuditExport", () => ({ generateGovernanceAuditQrPolicyReceiptAuditArtifact, getGovernanceAuditQrPolicyReceiptAuditExport, verifyGovernanceAuditQrPolicyReceiptAuditBytes }));
vi.mock("./db", () => ({ getGovernanceAuditQrExpiryPolicy, getGovernanceAuditQrRevocation, listGovernanceAuditQrExpiryPolicyHistory, revokeGovernanceAuditQrReference, updateGovernanceAuditQrExpiryPolicy }));

import { appRouter } from "./routers";

function caller(user: { openId: string; role: string } | null) {
  return appRouter.createCaller({ user, req: {} as any, res: { clearCookie: vi.fn() } as any });
}

describe("reports.monthlyArtifacts authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGovernanceAuditQrExpiryPolicy.mockResolvedValue({ ownerOpenId: "owner-1", validityMinutes: 30 });
    updateGovernanceAuditQrExpiryPolicy.mockImplementation(async (ownerOpenId: string, validityMinutes: number) => ({ ownerOpenId, validityMinutes }));
    listGovernanceAuditQrExpiryPolicyHistory.mockResolvedValue([]);
    getGovernanceAuditVerificationQrReference.mockReturnValue({ status: "verified", reference: {} });
    revokeGovernanceAuditQrReference.mockResolvedValue({ outcome: "revoked", revocation: { referenceId: `qr_${"a".repeat(32)}`, actorOpenId: "owner-1" } });
    getGovernanceAuditQrRevocation.mockResolvedValue(null);
    getGovernanceAuditQrPolicyAuditExport.mockResolvedValue({ kind: "storeos_governance_qr_policy_audit", version: 1, timezone: "Asia/Jakarta", generatedAt: new Date("2026-08-26T00:00:00.000Z"), filters: {}, recordCount: 0, records: [] });
    generateGovernanceAuditQrPolicyAuditArtifact.mockResolvedValue({ exportId: `storeos-qr-policy-audit-csv-${"c".repeat(64)}`, format: "csv", filename: "audit.csv", contentType: "text/csv;charset=utf-8", generatedAt: new Date("2026-08-26T00:00:00.000Z"), timezone: "Asia/Jakarta", filters: {}, scope: "scope", recordCount: 0, byteSize: 12, sha256: "c".repeat(64), bytesBase64: "77u/" });
    verifyGovernanceAuditQrPolicyAuditBytes.mockReturnValue({ verified: true, status: "verified", byteSize: 3 });
    getGovernanceAuditQrPolicyReceiptAuditExport.mockResolvedValue({ kind: "storeos_governance_qr_policy_receipt_audit", version: 1, timezone: "Asia/Jakarta", generatedAt: new Date("2026-08-27T00:00:00.000Z"), filters: {}, recordCount: 0, records: [] });
    generateGovernanceAuditQrPolicyReceiptAuditArtifact.mockResolvedValue({ exportId: `storeos-qr-policy-receipt-audit-csv-${"d".repeat(64)}`, format: "csv", filename: "combined.csv", contentType: "text/csv;charset=utf-8", generatedAt: new Date("2026-08-27T00:00:00.000Z"), timezone: "Asia/Jakarta", filters: {}, scope: "scope", recordCount: 0, byteSize: 12, sha256: "d".repeat(64), bytesBase64: "77u/" });
    verifyGovernanceAuditQrPolicyReceiptAuditBytes.mockReturnValue({ verified: true, status: "verified", byteSize: 3 });
  });

  it("rejects anonymous artifact access", async () => {
    await expect(caller(null).reports.monthlyArtifacts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an authenticated non-owner admin and prevents cross-workspace list access", async () => {
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifacts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listMonthlyReportArtifacts).not.toHaveBeenCalled();
  });

  it("allows the current StoreOS owner to request only their filtered metadata", async () => {
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifacts({ year: 2026, month: 1 })).resolves.toEqual([]);
    expect(listMonthlyReportArtifacts).toHaveBeenCalledWith("owner-1", { year: 2026, month: 1 });
  });

  it("limits governance totals to the current owner-admin scope", async () => {
    await expect(caller(null).reports.monthlyArtifactGovernance()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifactGovernance()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getMonthlyReportArtifactGovernanceSummary).not.toHaveBeenCalled();
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernance()).resolves.toEqual({ retainedArtifactCount: 0 });
    expect(getMonthlyReportArtifactGovernanceSummary).toHaveBeenCalledWith("owner-1");
  });

  it("limits lifecycle-history access to the owner-admin scope and forwards only the requested period", async () => {
    await expect(caller(null).reports.monthlyArtifactLifecycleHistory({ year: 2026, month: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifactLifecycleHistory({ year: 2026, month: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getMonthlyReportArtifactLifecycleHistory).not.toHaveBeenCalled();
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactLifecycleHistory({ year: 2026, month: 1 })).resolves.toBeNull();
    expect(getMonthlyReportArtifactLifecycleHistory).toHaveBeenCalledWith(2026, 1, "owner-1");
  });

  it("rejects anonymous, member, and cross-workspace archive approvals before the archive service is called", async () => {
    await expect(caller(null).reports.archiveMonthlyArtifact({ year: 2024, month: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.archiveMonthlyArtifact({ year: 2024, month: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.archiveMonthlyArtifact({ year: 2024, month: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(archiveMonthlyReportArtifactWithOwnerApproval).not.toHaveBeenCalled();
  });

  it("forwards an owner-admin approval using the authenticated owner scope as both actor and archive authority", async () => {
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.archiveMonthlyArtifact({ year: 2024, month: 1 })).resolves.toMatchObject({ outcome: "archived", artifact: { year: 2024, month: 1, lifecycleStatus: "archived" } });
    expect(archiveMonthlyReportArtifactWithOwnerApproval).toHaveBeenCalledWith(2024, 1, "owner-1", "owner-1");
  });

  it("rejects anonymous, member, and cross-workspace governance audit exports before the audit service is called", async () => {
    await expect(caller(null).reports.monthlyArtifactGovernanceAuditExport()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.monthlyArtifactGovernanceAuditExport()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.monthlyArtifactGovernanceAuditExport()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getMonthlyReportArtifactGovernanceAuditExport).not.toHaveBeenCalled();
  });

  it("forwards only owner-admin-selected audit filters to the scoped lifecycle export", async () => {
    const filters = { year: 2024, month: 1, lifecycleStatus: "archived" as const, artifactFormat: "pdf" as const, artifactScope: "archived_or_retired" as const };
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernanceAuditExport(filters)).resolves.toMatchObject({ kind: "storeos_governance_lifecycle_audit", recordCount: 0 });
    expect(getMonthlyReportArtifactGovernanceAuditExport).toHaveBeenCalledWith("owner-1", filters);
  });

  it("rejects anonymous, member, and cross-workspace exact-byte audit exports before bytes are generated", async () => {
    const input = { year: 2024, month: 1, format: "csv" as const };
    await expect(caller(null).reports.generateMonthlyArtifactGovernanceAuditExport(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.generateMonthlyArtifactGovernanceAuditExport(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.generateMonthlyArtifactGovernanceAuditExport(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(generateGovernanceAuditExportArtifact).not.toHaveBeenCalled();
  });

  it("generates only an owner-scoped exact-byte export and verifies only owner-admin supplied bytes", async () => {
    const input = { year: 2024, lifecycleStatus: "archived" as const, artifactFormat: "pdf" as const, format: "pdf" as const };
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.generateMonthlyArtifactGovernanceAuditExport(input)).resolves.toMatchObject({ format: "csv", byteSize: 12 });
    expect(generateGovernanceAuditExportArtifact).toHaveBeenCalledWith("owner-1", { year: 2024, lifecycleStatus: "archived", artifactFormat: "pdf" }, "pdf");

    const verification = { exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, bytesBase64: "77u/" };
    await expect(caller(null).reports.verifyMonthlyArtifactGovernanceAuditExport(verification)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.verifyMonthlyArtifactGovernanceAuditExport(verification)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.verifyMonthlyArtifactGovernanceAuditExport(verification)).resolves.toMatchObject({ verified: true, status: "verified" });
    expect(verifyGovernanceAuditExportBytes).toHaveBeenCalledWith(verification.exportId, verification.bytesBase64);
  });

  it("restricts policy audit queries, generation, and exact-byte verification to the authenticated owner-admin", async () => {
    const filters = { startDate: "2026-08-01", endDate: "2026-08-31", datePreset: "previous_month" as const, searchTerm: "qrph_policy_12", direction: "increase" as const, actorOpenId: "owner-1", scope: "governance_audit_qr_expiry" as const };
    const generation = { ...filters, format: "csv" as const };
    const verification = { exportId: `storeos-qr-policy-audit-csv-${"c".repeat(64)}`, bytesBase64: "77u/" };
    await expect(caller(null).reports.monthlyArtifactGovernanceAuditQrPolicyExport(filters)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.generateMonthlyArtifactGovernanceAuditQrPolicyExport(generation)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.verifyMonthlyArtifactGovernanceAuditQrPolicyExport(verification)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getGovernanceAuditQrPolicyAuditExport).not.toHaveBeenCalled();
    expect(generateGovernanceAuditQrPolicyAuditArtifact).not.toHaveBeenCalled();
    expect(verifyGovernanceAuditQrPolicyAuditBytes).not.toHaveBeenCalled();

    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernanceAuditQrPolicyExport(filters)).resolves.toMatchObject({ kind: "storeos_governance_qr_policy_audit", recordCount: 0 });
    expect(getGovernanceAuditQrPolicyAuditExport).toHaveBeenCalledWith("owner-1", filters);
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.generateMonthlyArtifactGovernanceAuditQrPolicyExport(generation)).resolves.toMatchObject({ format: "csv", byteSize: 12 });
    expect(generateGovernanceAuditQrPolicyAuditArtifact).toHaveBeenCalledWith("owner-1", filters, "csv");
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.verifyMonthlyArtifactGovernanceAuditQrPolicyExport(verification)).resolves.toMatchObject({ verified: true, status: "verified" });
    expect(verifyGovernanceAuditQrPolicyAuditBytes).toHaveBeenCalledWith(verification.exportId, verification.bytesBase64);
  });

  it("restricts combined QR policy and receipt audit query, generation, and exact-byte verification before service calls", async () => {
    const filters = { startDate: "2026-08-01", endDate: "2026-08-31", datePreset: "previous_month" as const, searchTerm: "receipt-001", direction: "increase" as const, actorOpenId: "owner-1", verificationStatus: "verified" as const, qrStatus: "active" as const, receiptFormat: "csv" as const, scope: "governance_audit_qr_policy_receipt" as const };
    const generation = { ...filters, format: "csv" as const };
    const verification = { exportId: `storeos-qr-policy-receipt-audit-csv-${"d".repeat(64)}`, bytesBase64: "77u/" };
    await expect(caller(null).reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport(filters)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.generateMonthlyArtifactGovernanceAuditQrPolicyReceiptExport(generation)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.verifyMonthlyArtifactGovernanceAuditQrPolicyReceiptExport(verification)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getGovernanceAuditQrPolicyReceiptAuditExport).not.toHaveBeenCalled();
    expect(generateGovernanceAuditQrPolicyReceiptAuditArtifact).not.toHaveBeenCalled();
    expect(verifyGovernanceAuditQrPolicyReceiptAuditBytes).not.toHaveBeenCalled();
  });

  it("forwards all validated combined filters only in the authenticated owner-admin scope", async () => {
    const filters = { startDate: "2026-08-01", endDate: "2026-08-31", datePreset: "last_30_days" as const, searchTerm: "export-2026-08", direction: "decrease" as const, actorOpenId: "owner-1", verificationStatus: "verified" as const, qrStatus: "revoked" as const, receiptFormat: "pdf" as const, scope: "governance_audit_qr_policy_receipt" as const };
    const generation = { ...filters, format: "pdf" as const };
    const verification = { exportId: `storeos-qr-policy-receipt-audit-csv-${"d".repeat(64)}`, bytesBase64: "77u/" };
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport(filters)).resolves.toMatchObject({ kind: "storeos_governance_qr_policy_receipt_audit", recordCount: 0 });
    expect(getGovernanceAuditQrPolicyReceiptAuditExport).toHaveBeenCalledWith("owner-1", filters);
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.generateMonthlyArtifactGovernanceAuditQrPolicyReceiptExport(generation)).resolves.toMatchObject({ format: "csv", byteSize: 12 });
    expect(generateGovernanceAuditQrPolicyReceiptAuditArtifact).toHaveBeenCalledWith("owner-1", filters, "pdf");
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.verifyMonthlyArtifactGovernanceAuditQrPolicyReceiptExport(verification)).resolves.toMatchObject({ verified: true, status: "verified" });
    expect(verifyGovernanceAuditQrPolicyReceiptAuditBytes).toHaveBeenCalledWith(verification.exportId, verification.bytesBase64);
  });

  it("accepts Phase 2.19 quarter and year review presets only through the existing owner-admin audit query contracts", async () => {
    for (const datePreset of ["current_quarter", "previous_quarter", "current_year"] as const) {
      const policyFilters = { datePreset, scope: "governance_audit_qr_expiry" as const };
      await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernanceAuditQrPolicyExport(policyFilters)).resolves.toMatchObject({ kind: "storeos_governance_qr_policy_audit" });
      expect(getGovernanceAuditQrPolicyAuditExport).toHaveBeenLastCalledWith("owner-1", policyFilters);

      const combinedFilters = { datePreset, scope: "governance_audit_qr_policy_receipt" as const };
      await expect(caller({ openId: "owner-1", role: "admin" }).reports.monthlyArtifactGovernanceAuditQrPolicyReceiptExport(combinedFilters)).resolves.toMatchObject({ kind: "storeos_governance_qr_policy_receipt_audit" });
      expect(getGovernanceAuditQrPolicyReceiptAuditExport).toHaveBeenLastCalledWith("owner-1", combinedFilters);
    }
    expect(generateGovernanceAuditQrPolicyAuditArtifact).not.toHaveBeenCalled();
    expect(generateGovernanceAuditQrPolicyReceiptAuditArtifact).not.toHaveBeenCalled();
  });

  it("rejects anonymous, member, and cross-workspace verification receipt requests before receipt issuance", async () => {
    const receiptInput = { exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, bytesBase64: "77u/", receiptFormat: "csv" as const };
    await expect(caller(null).reports.issueMonthlyArtifactGovernanceAuditVerificationReceipt(receiptInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.issueMonthlyArtifactGovernanceAuditVerificationReceipt(receiptInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.issueMonthlyArtifactGovernanceAuditVerificationReceipt(receiptInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(issueGovernanceAuditVerificationReceipt).not.toHaveBeenCalled();
  });

  it("forwards only the authenticated owner-admin's verified export context to receipt issuance", async () => {
    const receiptInput = { exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, bytesBase64: "77u/", receiptFormat: "pdf" as const };
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.issueMonthlyArtifactGovernanceAuditVerificationReceipt(receiptInput)).resolves.toMatchObject({ status: "issued", receipt: { receiptFormat: "csv" } });
    expect(getGovernanceAuditQrExpiryPolicy).toHaveBeenCalledWith("owner-1");
    expect(listGovernanceAuditQrExpiryPolicyHistory).toHaveBeenCalledWith("owner-1");
    expect(issueGovernanceAuditVerificationReceipt).toHaveBeenCalledWith("owner-1", {
      ...receiptInput,
      qrValidityMinutes: 30,
      qrPolicyContext: {
        validityMinutes: 30,
        policyEventId: null,
        previousValidityMinutes: null,
        change: "initial",
        differenceMinutes: 0,
      },
    });
  });

  it("restricts persisted QR expiry policy reads and updates to the authenticated owner-admin scope", async () => {
    await expect(caller(null).reports.getMonthlyArtifactGovernanceAuditQrExpiryPolicy()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.getMonthlyArtifactGovernanceAuditQrExpiryPolicy()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy({ validityMinutes: 90 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getGovernanceAuditQrExpiryPolicy).not.toHaveBeenCalled();
    expect(updateGovernanceAuditQrExpiryPolicy).not.toHaveBeenCalled();

    await expect(caller({ openId: "owner-1", role: "admin" }).reports.getMonthlyArtifactGovernanceAuditQrExpiryPolicy()).resolves.toEqual({ ownerOpenId: "owner-1", validityMinutes: 30 });
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy({ validityMinutes: 90 })).resolves.toEqual({ ownerOpenId: "owner-1", validityMinutes: 90 });
    expect(getGovernanceAuditQrExpiryPolicy).toHaveBeenCalledWith("owner-1");
    expect(updateGovernanceAuditQrExpiryPolicy).toHaveBeenCalledWith("owner-1", 90, "owner-1");
  });

  it("restricts policy-change history to the authenticated owner-admin and forwards only its owner scope", async () => {
    const history = [{ eventId: "qrph_test", previousValidityMinutes: 30, newValidityMinutes: 90, resultingValidityMinutes: 90, actorOpenId: "owner-1", changedAt: new Date("2026-08-26T08:00:00.000Z") }];
    listGovernanceAuditQrExpiryPolicyHistory.mockResolvedValue(history);
    await expect(caller(null).reports.listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listGovernanceAuditQrExpiryPolicyHistory).not.toHaveBeenCalled();
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.listMonthlyArtifactGovernanceAuditQrExpiryPolicyHistory()).resolves.toEqual(history);
    expect(listGovernanceAuditQrExpiryPolicyHistory).toHaveBeenCalledWith("owner-1");
  });

  it("rejects invalid QR expiry policy values before reaching persistence", async () => {
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy({ validityMinutes: 4 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.updateMonthlyArtifactGovernanceAuditQrExpiryPolicy({ validityMinutes: 10_081 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateGovernanceAuditQrExpiryPolicy).not.toHaveBeenCalled();
  });

  it("rejects anonymous, member, and cross-workspace QR verification resolution before the resolver is called", async () => {
    const qrInput = { referenceId: `qr_${"a".repeat(32)}`, exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, receiptId: `storeos-governance-audit-receipt-${"a".repeat(64)}` };
    await expect(caller(null).reports.resolveMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.resolveMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.resolveMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(resolveGovernanceAuditVerificationQr).not.toHaveBeenCalled();
  });

  it("resolves a QR reference only in the authenticated owner-admin scope", async () => {
    const qrInput = { referenceId: `qr_${"a".repeat(32)}`, exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, receiptId: `storeos-governance-audit-receipt-${"a".repeat(64)}` };
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.resolveMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).resolves.toMatchObject({ status: "verified", verificationStatus: "verified" });
    expect(resolveGovernanceAuditVerificationQr).toHaveBeenCalledWith("owner-1", qrInput);
  });

  it("rejects anonymous, members, and cross-workspace QR revocation or audit reads before governance state is touched", async () => {
    const qrInput = { referenceId: `qr_${"a".repeat(32)}`, exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, receiptId: `storeos-governance-audit-receipt-${"a".repeat(64)}`, reason: "Referensi salah distribusi" };
    await expect(caller(null).reports.revokeMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ openId: "owner-1", role: "user" }).reports.revokeMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ openId: "other-workspace", role: "admin" }).reports.getMonthlyArtifactGovernanceAuditQrRevocation({ referenceId: qrInput.referenceId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(revokeGovernanceAuditQrReference).not.toHaveBeenCalled();
    expect(getGovernanceAuditQrRevocation).not.toHaveBeenCalled();
  });

  it("records an owner-admin QR revocation once, preserves its audit record, and returns deterministic already-revoked state", async () => {
    const qrInput = { referenceId: `qr_${"a".repeat(32)}`, exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, receiptId: `storeos-governance-audit-receipt-${"a".repeat(64)}`, reason: "Referensi salah distribusi" };
    revokeGovernanceAuditQrReference.mockResolvedValueOnce({ outcome: "revoked", revocation: { referenceId: qrInput.referenceId, revokedAt: new Date("2026-08-26T05:00:00.000Z"), actorOpenId: "owner-1", reason: qrInput.reason, previousStatus: "verified", resultingStatus: "revoked" } });
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.revokeMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).resolves.toMatchObject({ outcome: "revoked" });
    expect(revokeGovernanceAuditQrReference).toHaveBeenCalledWith(expect.objectContaining({ ownerOpenId: "owner-1", actorOpenId: "owner-1", previousStatus: "verified", reason: qrInput.reason }));
    expect(revokeGovernanceAuditVerificationQrReference).toHaveBeenCalledWith(qrInput.referenceId);
    expect(archiveMonthlyReportArtifactWithOwnerApproval).not.toHaveBeenCalled();

    revokeGovernanceAuditQrReference.mockResolvedValueOnce({ outcome: "already_revoked", revocation: { referenceId: qrInput.referenceId } });
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.revokeMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).resolves.toMatchObject({ outcome: "already_revoked" });
    getGovernanceAuditQrRevocation.mockResolvedValue({ referenceId: qrInput.referenceId, actorOpenId: "owner-1", reason: qrInput.reason });
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.getMonthlyArtifactGovernanceAuditQrRevocation({ referenceId: qrInput.referenceId })).resolves.toMatchObject({ actorOpenId: "owner-1", reason: qrInput.reason });
    expect(getGovernanceAuditQrRevocation).toHaveBeenCalledWith("owner-1", qrInput.referenceId);
  });

  it("returns deterministic not-found outcome for an owner-admin revoke without writing a revocation event", async () => {
    getGovernanceAuditVerificationQrReference.mockReturnValueOnce({ status: "not_found", message: "Referensi QR verifikasi tidak ditemukan pada konteks server ini." });
    const qrInput = { referenceId: `qr_${"a".repeat(32)}`, exportId: `storeos-governance-audit-csv-${"a".repeat(64)}`, receiptId: `storeos-governance-audit-receipt-${"a".repeat(64)}` };
    await expect(caller({ openId: "owner-1", role: "admin" }).reports.revokeMonthlyArtifactGovernanceAuditVerificationQr(qrInput)).resolves.toMatchObject({ outcome: "not_found" });
    expect(revokeGovernanceAuditQrReference).not.toHaveBeenCalled();
  });
});
