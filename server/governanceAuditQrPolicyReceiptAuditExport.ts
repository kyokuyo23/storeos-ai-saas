import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";
import { getGovernanceAuditQrRevocation, listGovernanceAuditQrExpiryPolicyHistory } from "./db";
import { decodeExactGovernanceAuditBytes, hashExactGovernanceAuditBytes } from "./governanceAuditExportIntegrity";
import { listIssuedGovernanceAuditVerificationReceipts, type GovernanceAuditVerificationReceiptAuditRecord } from "./governanceAuditVerificationReceipts";

export type GovernanceAuditQrPolicyReceiptDirection = "initial" | "increase" | "decrease" | "unchanged";
export type GovernanceAuditQrPolicyReceiptVerificationStatus = "verified";
export type GovernanceAuditQrPolicyReceiptQrStatus = "active" | "expired" | "revoked" | "invalid";
export type GovernanceAuditQrPolicyReceiptScope = "governance_audit_qr_policy_receipt";
export type GovernanceAuditQrPolicyReceiptAuditFilters = {
  startDate?: string;
  endDate?: string;
  direction?: GovernanceAuditQrPolicyReceiptDirection;
  actorOpenId?: string;
  verificationStatus?: GovernanceAuditQrPolicyReceiptVerificationStatus;
  qrStatus?: GovernanceAuditQrPolicyReceiptQrStatus;
  receiptFormat?: "csv" | "pdf";
  scope?: GovernanceAuditQrPolicyReceiptScope;
};

export type GovernanceAuditQrPolicyReceiptAuditRecord = {
  correlationId: string;
  receiptId: string;
  receiptFormat: "csv" | "pdf";
  receiptVerificationStatus: "verified";
  receiptIssuedAt: Date;
  qrReferenceId: string;
  qrIssuedAt: Date | null;
  qrExpiresAt: Date | null;
  qrStatus: GovernanceAuditQrPolicyReceiptQrStatus;
  exportId: string;
  exportFormat: "csv" | "pdf";
  exportScope: string;
  policyEventId: string | null;
  policyPreviousValidityMinutes: number | null;
  policyValidityMinutes: number;
  policyDifferenceMinutes: number;
  policyDirection: GovernanceAuditQrPolicyReceiptDirection;
  policyActorOpenId: string | null;
  policyChangedAt: Date | null;
  policyCorrelation: "matched_policy_event" | "initial_policy";
  policyLabel: string;
  scope: GovernanceAuditQrPolicyReceiptScope;
};

export type GovernanceAuditQrPolicyReceiptAuditExport = {
  kind: "storeos_governance_qr_policy_receipt_audit";
  version: 1;
  generatedAt: Date;
  timezone: "Asia/Jakarta";
  filters: {
    startDate: string | null;
    endDate: string | null;
    direction: GovernanceAuditQrPolicyReceiptDirection | null;
    actorOpenId: string | null;
    verificationStatus: GovernanceAuditQrPolicyReceiptVerificationStatus | null;
    qrStatus: GovernanceAuditQrPolicyReceiptQrStatus | null;
    receiptFormat: "csv" | "pdf" | null;
    scope: GovernanceAuditQrPolicyReceiptScope | null;
    dateBoundary: "start_inclusive_end_exclusive_wib";
  };
  recordCount: number;
  records: GovernanceAuditQrPolicyReceiptAuditRecord[];
};

export type GovernanceAuditQrPolicyReceiptAuditFormat = "csv" | "pdf";
export type GovernanceAuditQrPolicyReceiptAuditArtifact = {
  kind: "storeos_governance_qr_policy_receipt_audit_export";
  version: 1;
  exportId: string;
  format: GovernanceAuditQrPolicyReceiptAuditFormat;
  filename: string;
  contentType: "text/csv;charset=utf-8" | "application/pdf";
  generatedAt: Date;
  timezone: "Asia/Jakarta";
  filters: GovernanceAuditQrPolicyReceiptAuditExport["filters"];
  scope: string;
  recordCount: number;
  byteSize: number;
  sha256: string;
  bytesBase64: string;
};

export type GovernanceAuditQrPolicyReceiptAuditVerification = {
  exportId: string;
  format: GovernanceAuditQrPolicyReceiptAuditFormat;
  expectedSha256: string;
  actualSha256: string;
  byteSize: number;
  status: "verified" | "hash_mismatch";
  verified: boolean;
};

const COMBINED_SCOPE: GovernanceAuditQrPolicyReceiptScope = "governance_audit_qr_policy_receipt";
const MAX_VERIFICATION_BYTES = 10 * 1024 * 1024;
const INITIAL_POLICY_LABEL = "Initial policy — no previous policy.";
const INITIAL_POLICY_TIME_LABEL = "Initial policy — no policy event timestamp.";
const COLUMNS = [
  "Correlation ID", "Receipt ID", "Format receipt", "Status verifikasi receipt", "Receipt diterbitkan (WIB)",
  "Referensi QR", "QR issuedAt (WIB)", "QR expiresAt (WIB)", "Status QR", "Export ID", "Format export", "Scope export",
  "Event kebijakan", "Kebijakan sebelumnya (menit)", "Kebijakan receipt (menit)", "Perbedaan (menit)", "Arah kebijakan",
  "Aktor kebijakan", "Policy changedAt (WIB)", "Korelasi kebijakan", "Label kebijakan", "Scope audit",
];

function wibTime(value: Date) {
  return `${value.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
}

function wibTimeOrInitial(value: Date | null) {
  return value ? wibTime(value) : INITIAL_POLICY_TIME_LABEL;
}

function escapeCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidWibDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function wibStart(value: string) {
  if (!isValidWibDate(value)) throw new Error("Tanggal filter harus berformat YYYY-MM-DD yang valid di Jakarta/WIB.");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7));
}

function nextWibDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function getReceiptQr(receipt: GovernanceAuditVerificationReceiptAuditRecord) {
  return receipt.qr as Partial<GovernanceAuditVerificationReceiptAuditRecord["qr"]> | undefined;
}

function isValidReceiptQr(receipt: GovernanceAuditVerificationReceiptAuditRecord) {
  const qr = getReceiptQr(receipt);
  if (!qr) return false;
  return /^qr_[a-f0-9]{32}$/.test(qr.referenceId ?? "")
    && qr.exportId === receipt.export.exportId
    && qr.receiptId === receipt.receiptId
    && qr.verificationStatus === "verified"
    && isValidDate(qr.issuedAt)
    && isValidDate(qr.expiresAt)
    && qr.expiresAt.getTime() >= qr.issuedAt.getTime();
}

function validateFilters(filters: GovernanceAuditQrPolicyReceiptAuditFilters) {
  if (filters.startDate && !isValidWibDate(filters.startDate)) throw new Error("Tanggal mulai filter QR harus valid di Jakarta/WIB.");
  if (filters.endDate && !isValidWibDate(filters.endDate)) throw new Error("Tanggal akhir filter QR harus valid di Jakarta/WIB.");
  if (filters.startDate && filters.endDate && wibStart(filters.startDate).getTime() > wibStart(filters.endDate).getTime()) throw new Error("Tanggal mulai tidak boleh setelah tanggal akhir.");
  if (filters.direction && !(["initial", "increase", "decrease", "unchanged"] as const).includes(filters.direction)) throw new Error("Arah kebijakan QR tidak valid.");
  if (filters.actorOpenId !== undefined && (!filters.actorOpenId.trim() || filters.actorOpenId.length > 64)) throw new Error("Aktor kebijakan QR tidak valid.");
  if (filters.verificationStatus && filters.verificationStatus !== "verified") throw new Error("Status verifikasi receipt tidak valid.");
  if (filters.qrStatus && !(["active", "expired", "revoked", "invalid"] as const).includes(filters.qrStatus)) throw new Error("Status QR tidak valid.");
  if (filters.receiptFormat && !(["csv", "pdf"] as const).includes(filters.receiptFormat)) throw new Error("Format receipt tidak valid.");
  if (filters.scope !== undefined && filters.scope !== COMBINED_SCOPE) throw new Error("Scope audit gabungan QR tidak valid.");
}

function auditScope(filters: GovernanceAuditQrPolicyReceiptAuditExport["filters"]) {
  return [
    `tanggal=${filters.startDate ?? "semua"} s.d. ${filters.endDate ?? "semua"} WIB`,
    `arah=${filters.direction ?? "semua"}`,
    `aktor=${filters.actorOpenId ?? "semua"}`,
    `status receipt=${filters.verificationStatus ?? "semua"}`,
    `status QR=${filters.qrStatus ?? "semua"}`,
    `format=${filters.receiptFormat ?? "semua"}`,
    `scope=${filters.scope ?? "semua"}`,
  ].join("; ");
}

/** Owner-scoped read-only correlation of issued receipt policy snapshots and append-only policy history. */
export async function getGovernanceAuditQrPolicyReceiptAuditExport(
  ownerOpenId: string,
  filters: GovernanceAuditQrPolicyReceiptAuditFilters = {},
  generatedAt = new Date(),
): Promise<GovernanceAuditQrPolicyReceiptAuditExport> {
  validateFilters(filters);
  const [history, receipts] = await Promise.all([
    listGovernanceAuditQrExpiryPolicyHistory(ownerOpenId),
    listIssuedGovernanceAuditVerificationReceipts(ownerOpenId),
  ]);
  const eventById = new Map(history.map((event) => [event.eventId, event]));
  const start = filters.startDate ? wibStart(filters.startDate) : null;
  const endExclusive = filters.endDate ? wibStart(nextWibDay(filters.endDate)) : null;
  const unfiltered = await Promise.all(receipts.map(async (receipt) => {
    const event = receipt.policy.policyEventId ? eventById.get(receipt.policy.policyEventId) : undefined;
    const correlated = Boolean(event);
    const policyDirection = correlated ? receipt.policy.change : "initial";
    const policyLabel = correlated ? receipt.policy.change : INITIAL_POLICY_LABEL;
    const qr = getReceiptQr(receipt);
    const qrIsValid = isValidReceiptQr(receipt);
    const revocation = qrIsValid ? await getGovernanceAuditQrRevocation(ownerOpenId, qr!.referenceId!) : null;
    const qrStatus: GovernanceAuditQrPolicyReceiptQrStatus = !qrIsValid
      ? "invalid"
      : revocation
        ? "revoked"
        : qr!.expiresAt!.getTime() <= generatedAt.getTime()
          ? "expired"
          : "active";
    return {
      correlationId: `${receipt.receiptId}:${receipt.receiptFormat}:${receipt.receiptSha256}`,
      receiptId: receipt.receiptId,
      receiptFormat: receipt.receiptFormat,
      receiptVerificationStatus: receipt.verification.status,
      receiptIssuedAt: receipt.verificationAt,
      qrReferenceId: typeof qr?.referenceId === "string" ? qr.referenceId : "Invalid QR reference",
      qrIssuedAt: qrIsValid ? qr!.issuedAt! : null,
      qrExpiresAt: qrIsValid ? qr!.expiresAt! : null,
      qrStatus,
      exportId: receipt.export.exportId,
      exportFormat: receipt.export.format,
      exportScope: receipt.export.scope,
      policyEventId: correlated ? receipt.policy.policyEventId : null,
      policyPreviousValidityMinutes: correlated ? receipt.policy.previousValidityMinutes : null,
      policyValidityMinutes: receipt.policy.validityMinutes,
      policyDifferenceMinutes: correlated ? receipt.policy.differenceMinutes : 0,
      policyDirection,
      policyActorOpenId: event?.actorOpenId ?? null,
      policyChangedAt: event?.changedAt ?? null,
      policyCorrelation: correlated ? "matched_policy_event" as const : "initial_policy" as const,
      policyLabel,
      scope: COMBINED_SCOPE,
    };
  }));
  const records = unfiltered.filter((record) => (
    (!start || record.receiptIssuedAt >= start)
    && (!endExclusive || record.receiptIssuedAt < endExclusive)
    && (!filters.direction || record.policyDirection === filters.direction)
    && (!filters.actorOpenId || record.policyActorOpenId === filters.actorOpenId)
    && (!filters.verificationStatus || record.receiptVerificationStatus === filters.verificationStatus)
    && (!filters.qrStatus || record.qrStatus === filters.qrStatus)
    && (!filters.receiptFormat || record.receiptFormat === filters.receiptFormat)
    && (!filters.scope || record.scope === filters.scope)
  )).sort((left, right) => (
    right.receiptIssuedAt.getTime() - left.receiptIssuedAt.getTime()
    || right.correlationId.localeCompare(left.correlationId)
  ));
  return {
    kind: "storeos_governance_qr_policy_receipt_audit",
    version: 1,
    generatedAt,
    timezone: "Asia/Jakarta",
    filters: {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      direction: filters.direction ?? null,
      actorOpenId: filters.actorOpenId ?? null,
      verificationStatus: filters.verificationStatus ?? null,
      qrStatus: filters.qrStatus ?? null,
      receiptFormat: filters.receiptFormat ?? null,
      scope: filters.scope ?? null,
      dateBoundary: "start_inclusive_end_exclusive_wib",
    },
    recordCount: records.length,
    records,
  };
}

function rows(audit: GovernanceAuditQrPolicyReceiptAuditExport) {
  const data = audit.records.map((record) => [
    record.correlationId, record.receiptId, record.receiptFormat, record.receiptVerificationStatus, wibTime(record.receiptIssuedAt),
    record.qrReferenceId, wibTimeOrInitial(record.qrIssuedAt), wibTimeOrInitial(record.qrExpiresAt), record.qrStatus, record.exportId, record.exportFormat, record.exportScope,
    record.policyEventId ?? INITIAL_POLICY_LABEL, record.policyPreviousValidityMinutes ?? INITIAL_POLICY_LABEL, record.policyValidityMinutes,
    record.policyDifferenceMinutes, record.policyDirection, record.policyActorOpenId ?? INITIAL_POLICY_LABEL, wibTimeOrInitial(record.policyChangedAt), record.policyCorrelation,
    record.policyLabel, record.scope,
  ]);
  return [
    ["StoreOS Combined QR Policy & Receipt Audit Export", `v${audit.version}`],
    ["Jenis laporan", "Governance / policy snapshot dan verification receipt"],
    ["Generated At (Asia/Jakarta)", wibTime(audit.generatedAt)], ["Timezone", audit.timezone],
    ["Batas tanggal", "mulai inklusif; akhir eksklusif setelah akhir tanggal WIB"],
    ["Filter tanggal mulai", audit.filters.startDate ?? "Semua"], ["Filter tanggal akhir", audit.filters.endDate ?? "Semua"],
    ["Filter arah", audit.filters.direction ?? "Semua"], ["Filter aktor", audit.filters.actorOpenId ?? "Semua"],
    ["Filter status verifikasi", audit.filters.verificationStatus ?? "Semua"], ["Filter status QR", audit.filters.qrStatus ?? "Semua"], ["Filter format receipt", audit.filters.receiptFormat ?? "Semua"],
    ["Filter scope", audit.filters.scope ?? "Semua"], ["Jumlah record", audit.recordCount],
    ["Export ID", "Tersedia pada metadata integritas protected agar hash exact-byte tidak self-referential."],
    ["Ukuran byte", "Tersedia pada metadata integritas protected."], ["SHA-256", "Tersedia pada metadata integritas protected."],
    [], COLUMNS, ...data,
  ].map((row) => [...row, ...Array.from({ length: COLUMNS.length - row.length }, () => "")]);
}

export function buildGovernanceAuditQrPolicyReceiptAuditCsvBytes(audit: GovernanceAuditQrPolicyReceiptAuditExport) {
  return Buffer.from(`\uFEFF${rows(audit).map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

function buildPrintableHtml(audit: GovernanceAuditQrPolicyReceiptAuditExport) {
  const cells = (values: Array<string | number | null | undefined>, tag = "td") => values.map((value) => `<${tag}>${escapeHtml(value)}</${tag}>`).join("");
  const records = audit.records.map((record) => `<tr>${cells([
    record.correlationId, record.receiptId, record.receiptFormat, record.receiptVerificationStatus, wibTime(record.receiptIssuedAt),
    record.qrReferenceId, wibTimeOrInitial(record.qrIssuedAt), wibTimeOrInitial(record.qrExpiresAt), record.qrStatus, record.exportId, record.exportFormat, record.exportScope,
    record.policyEventId ?? INITIAL_POLICY_LABEL, record.policyPreviousValidityMinutes ?? INITIAL_POLICY_LABEL, record.policyValidityMinutes,
    record.policyDifferenceMinutes, record.policyDirection, record.policyActorOpenId ?? INITIAL_POLICY_LABEL, wibTimeOrInitial(record.policyChangedAt), record.policyCorrelation,
    record.policyLabel, record.scope,
  ])}</tr>`).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>StoreOS Combined QR Policy & Receipt Audit</title><style>body{font-family:Arial,sans-serif;color:#17251f;font-size:9px;padding:24px}h1{font-size:18px;margin:0 0 6px}p{margin:3px 0}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #cbd8d0;padding:4px;vertical-align:top;text-align:left;word-break:break-word}th{background:#edf6f0;font-size:7px}</style></head><body><h1>StoreOS Combined QR Policy & Receipt Audit</h1><p><strong>Dibuat:</strong> ${escapeHtml(wibTime(audit.generatedAt))}</p><p><strong>Timezone:</strong> Asia/Jakarta</p><p><strong>Scope:</strong> ${escapeHtml(auditScope(audit.filters))}</p><p><strong>Jumlah record:</strong> ${audit.recordCount}</p><p><strong>Integritas:</strong> Export ID, ukuran byte, dan SHA-256 tersedia pada metadata protected hasil generasi untuk menjaga hash exact-byte non-self-referential.</p><table><thead><tr>${cells(COLUMNS, "th")}</tr></thead><tbody>${records || `<tr><td colspan="${COLUMNS.length}">Tidak ada receipt policy untuk filter ini.</td></tr>`}</tbody></table></body></html>`;
}

export async function generateGovernanceAuditQrPolicyReceiptAuditArtifact(
  ownerOpenId: string,
  filters: GovernanceAuditQrPolicyReceiptAuditFilters,
  format: GovernanceAuditQrPolicyReceiptAuditFormat,
  generatedAt = new Date(),
): Promise<GovernanceAuditQrPolicyReceiptAuditArtifact> {
  const audit = await getGovernanceAuditQrPolicyReceiptAuditExport(ownerOpenId, filters, generatedAt);
  const bytes = format === "csv"
    ? buildGovernanceAuditQrPolicyReceiptAuditCsvBytes(audit)
    : printableMonthlyHtmlToPdf(buildPrintableHtml(audit), {
      title: "StoreOS Combined QR Policy & Receipt Audit",
      subject: "Read-only owner-admin policy snapshot and verification receipt correlation export",
      creationDate: audit.generatedAt,
    });
  const sha256 = hashExactGovernanceAuditBytes(bytes);
  return {
    kind: "storeos_governance_qr_policy_receipt_audit_export",
    version: 1,
    exportId: `storeos-qr-policy-receipt-audit-${format}-${sha256}`,
    format,
    filename: `storeos-qr-policy-receipt-audit-${audit.filters.startDate ?? "all"}-${audit.filters.endDate ?? "all"}.${format}`,
    contentType: format === "csv" ? "text/csv;charset=utf-8" : "application/pdf",
    generatedAt: audit.generatedAt,
    timezone: audit.timezone,
    filters: audit.filters,
    scope: auditScope(audit.filters),
    recordCount: audit.recordCount,
    byteSize: bytes.byteLength,
    sha256,
    bytesBase64: bytes.toString("base64"),
  };
}

export function verifyGovernanceAuditQrPolicyReceiptAuditBytes(exportId: string, bytesBase64: string): GovernanceAuditQrPolicyReceiptAuditVerification {
  const match = /^storeos-qr-policy-receipt-audit-(csv|pdf)-([a-f0-9]{64})$/.exec(exportId);
  if (!match) throw new Error("Invalid QR policy receipt audit export identifier");
  const bytes = decodeExactGovernanceAuditBytes(bytesBase64);
  if (!bytes.length || bytes.byteLength > MAX_VERIFICATION_BYTES) throw new Error("Invalid QR policy receipt audit export bytes");
  const actualSha256 = hashExactGovernanceAuditBytes(bytes);
  const expectedSha256 = match[2];
  return {
    exportId,
    format: match[1] as GovernanceAuditQrPolicyReceiptAuditFormat,
    expectedSha256,
    actualSha256,
    byteSize: bytes.byteLength,
    status: actualSha256 === expectedSha256 ? "verified" : "hash_mismatch",
    verified: actualSha256 === expectedSha256,
  };
}
