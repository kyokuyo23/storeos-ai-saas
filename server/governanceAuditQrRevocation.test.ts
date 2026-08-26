import { describe, expect, it } from "vitest";
import { GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH, normalizeGovernanceAuditQrRevocationReason } from "./governanceAuditQrRevocation";

describe("Phase 2.12 governance audit QR revocation reason", () => {
  it("preserves a valid optional owner-admin reason exactly as entered", () => {
    expect(normalizeGovernanceAuditQrRevocationReason("  Salah distribusi ke auditor eksternal  ")).toBe("  Salah distribusi ke auditor eksternal  ");
    expect(normalizeGovernanceAuditQrRevocationReason("")).toBeNull();
    expect(normalizeGovernanceAuditQrRevocationReason()).toBeNull();
  });

  it("rejects oversized, control-character, and credential-bearing reasons before persistence", () => {
    expect(() => normalizeGovernanceAuditQrRevocationReason("x".repeat(GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH + 1))).toThrow("maksimal");
    expect(() => normalizeGovernanceAuditQrRevocationReason("Tidak lagi valid\u0000")).toThrow("karakter kontrol");
    expect(() => normalizeGovernanceAuditQrRevocationReason("api_key=rahasia")).toThrow("kredensial");
  });
});
