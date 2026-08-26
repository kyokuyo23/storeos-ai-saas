import { describe, expect, it, vi } from "vitest";

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

import { appRouter } from "./routers";

function caller(user: { openId: string; role: string } | null) {
  return appRouter.createCaller({ user, req: {} as any, res: { clearCookie: vi.fn() } as any });
}

describe("reports.monthlyArtifacts authorization", () => {
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
    expect(issueGovernanceAuditVerificationReceipt).toHaveBeenCalledWith("owner-1", receiptInput);
  });
});
