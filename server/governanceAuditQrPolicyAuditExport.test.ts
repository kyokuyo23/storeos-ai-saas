import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listGovernanceAuditQrExpiryPolicyHistory } = vi.hoisted(() => ({
  listGovernanceAuditQrExpiryPolicyHistory: vi.fn(),
}));

vi.mock("./db", () => ({ listGovernanceAuditQrExpiryPolicyHistory }));

import {
  deriveGovernanceAuditQrPolicyDirection,
  generateGovernanceAuditQrPolicyAuditArtifact,
  getGovernanceAuditQrPolicyAuditExport,
  verifyGovernanceAuditQrPolicyAuditBytes,
} from "./governanceAuditQrPolicyAuditExport";

const generatedAt = new Date("2026-08-26T01:15:00.000Z");
const history = [
  { id: 3, eventId: "qrph_gamma", ownerOpenId: "owner-1", previousValidityMinutes: 90, newValidityMinutes: 45, resultingValidityMinutes: 45, changedAt: new Date("2026-08-25T17:30:00.000Z"), actorOpenId: "admin-café" },
  { id: 2, eventId: "qrph_beta", ownerOpenId: "owner-1", previousValidityMinutes: 30, newValidityMinutes: 90, resultingValidityMinutes: 90, changedAt: new Date("2026-08-24T17:00:00.000Z"), actorOpenId: "admin-b" },
  { id: 1, eventId: "qrph_alpha", ownerOpenId: "owner-1", previousValidityMinutes: 30, newValidityMinutes: 30, resultingValidityMinutes: 30, changedAt: new Date("2026-08-23T16:59:59.000Z"), actorOpenId: "admin-a" },
];

describe("Phase 2.15 QR policy audit export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGovernanceAuditQrExpiryPolicyHistory.mockResolvedValue(history);
  });

  it("derives initial, increase, decrease, and no-op direction without reconstructing policy history", () => {
    expect(deriveGovernanceAuditQrPolicyDirection(null, 30)).toBe("initial");
    expect(deriveGovernanceAuditQrPolicyDirection(30, 90)).toBe("increase");
    expect(deriveGovernanceAuditQrPolicyDirection(90, 45)).toBe("decrease");
    expect(deriveGovernanceAuditQrPolicyDirection(30, 30)).toBe("no_op");
  });

  it("filters persisted owner-scoped events with deterministic inclusive/exclusive Jakarta date boundaries, actor, direction, and scope", async () => {
    const audit = await getGovernanceAuditQrPolicyAuditExport("owner-1", {
      startDate: "2026-08-25",
      endDate: "2026-08-26",
      direction: "decrease",
      actorOpenId: "admin-café",
      scope: "governance_audit_qr_expiry",
    }, generatedAt);

    expect(listGovernanceAuditQrExpiryPolicyHistory).toHaveBeenCalledWith("owner-1");
    expect(audit).toMatchObject({
      generatedAt,
      timezone: "Asia/Jakarta",
      recordCount: 1,
      filters: { startDate: "2026-08-25", endDate: "2026-08-26", direction: "decrease", actorOpenId: "admin-café", scope: "governance_audit_qr_expiry", dateBoundary: "start_inclusive_end_exclusive_wib" },
    });
    expect(audit.records[0]).toMatchObject({ eventId: "qrph_gamma", previousValidityMinutes: 90, newValidityMinutes: 45, deltaMinutes: -45, direction: "decrease", result: "updated", actorOpenId: "admin-café" });
  });

  it("accepts the shared Jakarta preset and literal policy event or actor searches without changing deterministic ordering", async () => {
    const byPreset = await getGovernanceAuditQrPolicyAuditExport("owner-1", { datePreset: "last_7_days", searchTerm: "admin", scope: "governance_audit_qr_expiry" }, generatedAt);
    expect(byPreset.filters).toMatchObject({ datePreset: "last_7_days", datePresetLabel: "7 hari terakhir", startDate: "2026-08-20", endDate: "2026-08-26", startWib: "2026-08-20 00:00:00 WIB", endWib: "2026-08-27 00:00:00 WIB", searchTerm: "admin" });
    expect(byPreset.records.map((record) => record.eventId)).toEqual(["qrph_gamma", "qrph_beta", "qrph_alpha"]);
    const byEvent = await getGovernanceAuditQrPolicyAuditExport("owner-1", { searchTerm: "qrph_beta" }, generatedAt);
    expect(byEvent.records.map((record) => record.eventId)).toEqual(["qrph_beta"]);
  });

  it("generates quoted Unicode UTF-8 BOM CSV exact bytes with deterministic headers and protected integrity metadata", async () => {
    const artifact = await generateGovernanceAuditQrPolicyAuditArtifact("owner-1", { scope: "governance_audit_qr_expiry" }, "csv", generatedAt);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");
    const text = bytes.toString("utf8");

    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(text).toContain('"ID event kebijakan"');
    expect(text).toContain('"admin-café"');
    expect(text).toContain('"Filter arah","Semua"');
    expect(artifact).toMatchObject({
      format: "csv",
      generatedAt,
      recordCount: 3,
      byteSize: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      exportId: `storeos-qr-policy-audit-csv-${createHash("sha256").update(bytes).digest("hex")}`,
    });
  });

  it("generates real PDF bytes and reports exact-byte verification or a tamper mismatch without regeneration", async () => {
    const artifact = await generateGovernanceAuditQrPolicyAuditArtifact("owner-1", {}, "pdf", generatedAt);
    const bytes = Buffer.from(artifact.bytesBase64, "base64");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(verifyGovernanceAuditQrPolicyAuditBytes(artifact.exportId, artifact.bytesBase64)).toMatchObject({ verified: true, status: "verified", byteSize: artifact.byteSize, expectedSha256: artifact.sha256 });

    bytes[bytes.byteLength - 2] ^= 0x01;
    expect(verifyGovernanceAuditQrPolicyAuditBytes(artifact.exportId, bytes.toString("base64"))).toMatchObject({ verified: false, status: "hash_mismatch", expectedSha256: artifact.sha256 });
    expect(() => verifyGovernanceAuditQrPolicyAuditBytes(artifact.exportId, "not-valid-base64")).toThrow("Invalid governance audit export bytes");
    expect(listGovernanceAuditQrExpiryPolicyHistory).toHaveBeenCalledTimes(1);
  });
});
