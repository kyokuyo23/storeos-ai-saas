export const GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES = 30;
export const GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES = 5;
export const GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES = 10_080;

export function isValidGovernanceAuditQrValidityMinutes(value: number) {
  return Number.isInteger(value)
    && value >= GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES
    && value <= GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES;
}

export function resolveGovernanceAuditQrExpiryPolicyChange(previousValidityMinutes: number, requestedValidityMinutes: number) {
  if (!isValidGovernanceAuditQrValidityMinutes(previousValidityMinutes) || !isValidGovernanceAuditQrValidityMinutes(requestedValidityMinutes)) {
    throw new Error("Masa berlaku QR harus berada dalam batas yang diizinkan.");
  }
  return {
    outcome: previousValidityMinutes === requestedValidityMinutes ? "unchanged" as const : "updated" as const,
    previousValidityMinutes,
    resultingValidityMinutes: requestedValidityMinutes,
  };
}

export type GovernanceAuditQrExpiryPolicyHistoryContext = {
  eventId: string;
  previousValidityMinutes: number;
  resultingValidityMinutes: number;
};

export type GovernanceAuditQrReceiptPolicyContext = {
  validityMinutes: number;
  policyEventId: string | null;
  previousValidityMinutes: number | null;
  change: "initial" | "increase" | "decrease" | "unchanged";
  differenceMinutes: number;
};

export function deriveGovernanceAuditQrReceiptPolicyContext(
  validityMinutes: number,
  history: GovernanceAuditQrExpiryPolicyHistoryContext[] = [],
): GovernanceAuditQrReceiptPolicyContext {
  if (!isValidGovernanceAuditQrValidityMinutes(validityMinutes)) {
    throw new Error("Masa berlaku QR harus berada dalam batas yang diizinkan.");
  }
  const latestEffectiveEvent = history.find((event) => event.resultingValidityMinutes === validityMinutes);
  if (!latestEffectiveEvent) {
    return {
      validityMinutes,
      policyEventId: null,
      previousValidityMinutes: null,
      change: "initial",
      differenceMinutes: 0,
    };
  }
  const differenceMinutes = validityMinutes - latestEffectiveEvent.previousValidityMinutes;
  return {
    validityMinutes,
    policyEventId: latestEffectiveEvent.eventId,
    previousValidityMinutes: latestEffectiveEvent.previousValidityMinutes,
    change: differenceMinutes === 0 ? "unchanged" : differenceMinutes > 0 ? "increase" : "decrease",
    differenceMinutes,
  };
}
