export const GOVERNANCE_AUDIT_QR_DEFAULT_VALIDITY_MINUTES = 30;
export const GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES = 5;
export const GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES = 10_080;

export function isValidGovernanceAuditQrValidityMinutes(value: number) {
  return Number.isInteger(value)
    && value >= GOVERNANCE_AUDIT_QR_MIN_VALIDITY_MINUTES
    && value <= GOVERNANCE_AUDIT_QR_MAX_VALIDITY_MINUTES;
}
