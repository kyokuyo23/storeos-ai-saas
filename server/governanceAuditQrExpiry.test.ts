import { describe, expect, it } from "vitest";
import {
  GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES,
  GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES,
  GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES,
  isValidGovernanceAuditQrValidityMinutes,
  resolveGovernanceAuditQrExpiryPolicyChange,
} from "./governanceAuditQrExpiry";

describe("Phase 2.11 governance audit QR expiry policy bounds", () => {
  it("publishes a conservative default and explicit inclusive bounds", () => {
    expect(GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES).toBe(30);
    expect(GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES).toBe(5);
    expect(GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES).toBe(10_080);
    expect(isValidGovernanceAuditQrValidityMinutes(5)).toBe(true);
    expect(isValidGovernanceAuditQrValidityMinutes(30)).toBe(true);
    expect(isValidGovernanceAuditQrValidityMinutes(10_080)).toBe(true);
  });

  it("rejects non-integer and out-of-range validity values before issuance or persistence", () => {
    for (const value of [0, 4, 10_081, 30.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidGovernanceAuditQrValidityMinutes(value)).toBe(false);
    }
  });

  it("records only effective policy changes and makes unchanged requests deterministic no-ops", () => {
    expect(resolveGovernanceAuditQrExpiryPolicyChange(30, 30)).toEqual({ outcome: "unchanged", previousValidityMinutes: 30, resultingValidityMinutes: 30 });
    expect(resolveGovernanceAuditQrExpiryPolicyChange(30, 90)).toEqual({ outcome: "updated", previousValidityMinutes: 30, resultingValidityMinutes: 90 });
    expect(() => resolveGovernanceAuditQrExpiryPolicyChange(4, 30)).toThrow("batas yang diizinkan");
  });
});
