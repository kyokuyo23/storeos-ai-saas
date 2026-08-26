export const GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH = 500;

const credentialPattern = /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|authorization)\b\s*[:=]/i;
const controlCharacterPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Preserves a valid reason verbatim. Blank input remains absent so it is not
 * represented as a synthetic audit note; credentials and control characters
 * are rejected before any persisted governance state is written.
 */
export function normalizeGovernanceAuditQrRevocationReason(reason?: string | null) {
  if (reason === undefined || reason === null || reason === "") return null;
  if (typeof reason !== "string" || reason.length > GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH) {
    throw new Error(`Alasan pencabutan QR maksimal ${GOVERNANCE_AUDIT_QR_REVOCATION_REASON_MAX_LENGTH} karakter.`);
  }
  if (controlCharacterPattern.test(reason)) throw new Error("Alasan pencabutan QR berisi karakter kontrol yang tidak diizinkan.");
  if (credentialPattern.test(reason)) throw new Error("Alasan pencabutan QR tidak boleh memuat kredensial atau rahasia.");
  return reason;
}
