import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";
import { listGovernanceAuditQrExpiryPolicyHistory } from "./db";
import { decodeExactGovernanceAuditBytes, hashExactGovernanceAuditBytes } from "./governanceAuditExportIntegrity";
import { governanceAuditWibStart, matchesGovernanceAuditSearch, resolveGovernanceAuditDateRange, validateGovernanceAuditDateSearchFilters, type GovernanceAuditDatePreset } from "./governanceAuditDateSearch";

export type GovernanceAuditQrPolicyDirection = "increase" | "decrease" | "initial" | "no_op";
export type GovernanceAuditQrPolicyAuditScope = "governance_audit_qr_expiry";
export type GovernanceAuditQrPolicyAuditFilters = {
  startDate?: string;
  endDate?: string;
  datePreset?: GovernanceAuditDatePreset;
  searchTerm?: string;
  direction?: GovernanceAuditQrPolicyDirection;
  actorOpenId?: string;
  scope?: GovernanceAuditQrPolicyAuditScope;
};

export type GovernanceAuditQrPolicyAuditRecord = {
  eventId: string;
  previousValidityMinutes: number | null;
  newValidityMinutes: number;
  deltaMinutes: number;
  direction: GovernanceAuditQrPolicyDirection;
  result: "updated" | "unchanged";
  changedAt: Date;
  actorOpenId: string;
  scope: GovernanceAuditQrPolicyAuditScope;
};

export type GovernanceAuditQrPolicyAuditExport = {
  kind: "storeos_governance_qr_policy_audit";
  version: 1;
  generatedAt: Date;
  timezone: "Asia/Jakarta";
  filters: {
    startDate: string | null;
    endDate: string | null;
    datePreset: GovernanceAuditDatePreset | null;
    datePresetLabel: string | null;
    startWib: string | null;
    endWib: string | null;
    searchTerm: string | null;
    direction: GovernanceAuditQrPolicyDirection | null;
    actorOpenId: string | null;
    scope: GovernanceAuditQrPolicyAuditScope | null;
    dateBoundary: "start_inclusive_end_exclusive_wib";
  };
  recordCount: number;
  records: GovernanceAuditQrPolicyAuditRecord[];
};

export type GovernanceAuditQrPolicyAuditFormat = "csv" | "pdf";
export type GovernanceAuditQrPolicyAuditArtifact = {
  kind: "storeos_governance_qr_policy_audit_export";
  version: 1;
  exportId: string;
  format: GovernanceAuditQrPolicyAuditFormat;
  filename: string;
  contentType: "text/csv;charset=utf-8" | "application/pdf";
  generatedAt: Date;
  timezone: "Asia/Jakarta";
  filters: GovernanceAuditQrPolicyAuditExport["filters"];
  scope: string;
  recordCount: number;
  byteSize: number;
  sha256: string;
  bytesBase64: string;
};

export type GovernanceAuditQrPolicyAuditVerification = {
  exportId: string;
  format: GovernanceAuditQrPolicyAuditFormat;
  expectedSha256: string;
  actualSha256: string;
  byteSize: number;
  status: "verified" | "hash_mismatch";
  verified: boolean;
};

const POLICY_AUDIT_COLUMNS = [
  "ID event kebijakan", "Durasi sebelumnya (menit)", "Durasi baru (menit)", "Delta (menit)", "Arah", "Hasil", "Diubah pada (WIB)", "Aktor owner-admin", "Scope berlaku",
];
const MAX_VERIFICATION_BYTES = 10 * 1024 * 1024;
const POLICY_AUDIT_SCOPE: GovernanceAuditQrPolicyAuditScope = "governance_audit_qr_expiry";

function wibTime(value: Date | string | null) {
  return value ? `${new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB` : "";
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

function validateFilters(filters: GovernanceAuditQrPolicyAuditFilters) {
  validateGovernanceAuditDateSearchFilters(filters);
  if (filters.direction && !(["increase", "decrease", "initial", "no_op"] as const).includes(filters.direction)) throw new Error("Arah perubahan kebijakan QR tidak valid.");
  if (filters.actorOpenId !== undefined && (!filters.actorOpenId.trim() || filters.actorOpenId.length > 64)) throw new Error("Aktor kebijakan QR tidak valid.");
  if (filters.scope !== undefined && filters.scope !== POLICY_AUDIT_SCOPE) throw new Error("Scope audit kebijakan QR tidak valid.");
}

export function deriveGovernanceAuditQrPolicyDirection(previousValidityMinutes: number | null, newValidityMinutes: number): GovernanceAuditQrPolicyDirection {
  if (previousValidityMinutes === null) return "initial";
  if (newValidityMinutes > previousValidityMinutes) return "increase";
  if (newValidityMinutes < previousValidityMinutes) return "decrease";
  return "no_op";
}

function auditScope(filters: GovernanceAuditQrPolicyAuditExport["filters"]) {
  return [
    `tanggal=${filters.startDate ?? "semua"} s.d. ${filters.endDate ?? "semua"} WIB`,
    `preset=${filters.datePresetLabel ?? "manual"}`,
    `pencarian=${filters.searchTerm ?? "semua"}`,
    `arah=${filters.direction ?? "semua"}`,
    `aktor=${filters.actorOpenId ?? "semua"}`,
    `scope=${filters.scope ?? "semua"}`,
  ].join("; ");
}

/** Owner-scoped, read-only export of persisted append-only policy events. */
export async function getGovernanceAuditQrPolicyAuditExport(
  ownerOpenId: string,
  filters: GovernanceAuditQrPolicyAuditFilters = {},
  generatedAt = new Date(),
): Promise<GovernanceAuditQrPolicyAuditExport> {
  validateFilters(filters);
  const history = await listGovernanceAuditQrExpiryPolicyHistory(ownerOpenId);
  const resolvedRange = resolveGovernanceAuditDateRange(filters, generatedAt);
  const start = resolvedRange.startDate ? governanceAuditWibStart(resolvedRange.startDate) : null;
  const endExclusive = resolvedRange.endWib ? governanceAuditWibStart(resolvedRange.endWib.slice(0, 10)) : null;
  const records = history.map((event) => {
    const direction = deriveGovernanceAuditQrPolicyDirection(event.previousValidityMinutes, event.newValidityMinutes);
    return {
      eventId: event.eventId,
      previousValidityMinutes: event.previousValidityMinutes,
      newValidityMinutes: event.newValidityMinutes,
      deltaMinutes: event.newValidityMinutes - event.previousValidityMinutes,
      direction,
      result: direction === "no_op" ? "unchanged" as const : "updated" as const,
      changedAt: event.changedAt,
      actorOpenId: event.actorOpenId,
      scope: POLICY_AUDIT_SCOPE,
    };
  }).filter((event) => (
    (!start || event.changedAt >= start)
    && (!endExclusive || event.changedAt < endExclusive)
    && (!filters.direction || event.direction === filters.direction)
    && (!filters.actorOpenId || event.actorOpenId === filters.actorOpenId)
    && matchesGovernanceAuditSearch(filters.searchTerm, [event.eventId, event.actorOpenId])
    && (!filters.scope || event.scope === filters.scope)
  )).sort((left, right) => (
    right.changedAt.getTime() - left.changedAt.getTime()
    || right.eventId.localeCompare(left.eventId)
  ));
  return {
    kind: "storeos_governance_qr_policy_audit",
    version: 1,
    generatedAt,
    timezone: "Asia/Jakarta",
    filters: {
      startDate: resolvedRange.startDate,
      endDate: resolvedRange.endDate,
      datePreset: resolvedRange.preset,
      datePresetLabel: resolvedRange.label,
      startWib: resolvedRange.startWib,
      endWib: resolvedRange.endWib,
      searchTerm: filters.searchTerm?.trim() || null,
      direction: filters.direction ?? null,
      actorOpenId: filters.actorOpenId ?? null,
      scope: filters.scope ?? null,
      dateBoundary: "start_inclusive_end_exclusive_wib",
    },
    recordCount: records.length,
    records,
  };
}

function csvRows(audit: GovernanceAuditQrPolicyAuditExport) {
  const rows: Array<Array<string | number | null>> = [
    ["StoreOS QR Policy Audit Snapshot Export", `v${audit.version}`],
    ["Jenis laporan", "Governance / QR expiry-policy audit"],
    ["Generated At (Asia/Jakarta)", wibTime(audit.generatedAt)],
    ["Timezone", audit.timezone],
    ["Batas tanggal", "mulai inklusif; akhir eksklusif setelah akhir tanggal WIB"],
    ["Filter tanggal mulai", audit.filters.startDate ?? "Semua"],
    ["Filter tanggal akhir", audit.filters.endDate ?? "Semua"],
    ["Preset rentang waktu", audit.filters.datePresetLabel ?? "Manual"],
    ["Rentang efektif WIB", `${audit.filters.startWib ?? "Tidak dibatasi"} s.d. ${audit.filters.endWib ?? "Tidak dibatasi"}`],
    ["Filter pencarian", audit.filters.searchTerm ?? "Semua"],
    ["Filter arah", audit.filters.direction ?? "Semua"],
    ["Filter aktor", audit.filters.actorOpenId ?? "Semua"],
    ["Filter scope", audit.filters.scope ?? "Semua"],
    ["Jumlah record", audit.recordCount],
    ["Export ID", "Tersedia pada metadata integritas protected agar hash exact-byte tidak bersifat self-referential."],
    ["Ukuran byte", "Tersedia pada metadata integritas protected."],
    ["SHA-256", "Tersedia pada metadata integritas protected."],
    [],
    POLICY_AUDIT_COLUMNS,
    ...audit.records.map((record) => [
      record.eventId,
      record.previousValidityMinutes,
      record.newValidityMinutes,
      record.deltaMinutes,
      record.direction,
      record.result,
      wibTime(record.changedAt),
      record.actorOpenId,
      record.scope,
    ]),
  ];
  return rows.map((row) => [...row, ...Array.from({ length: POLICY_AUDIT_COLUMNS.length - row.length }, () => "")]);
}

export function buildGovernanceAuditQrPolicyAuditCsvBytes(audit: GovernanceAuditQrPolicyAuditExport) {
  return Buffer.from(`\uFEFF${csvRows(audit).map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

function buildGovernanceAuditQrPolicyAuditPrintableHtml(audit: GovernanceAuditQrPolicyAuditExport) {
  const cells = (values: Array<string | number | null | undefined>, tag = "td") => values.map((value) => `<${tag}>${escapeHtml(value)}</${tag}>`).join("");
  const headers = cells(POLICY_AUDIT_COLUMNS, "th");
  const records = audit.records.map((record) => `<tr>${cells([
    record.eventId,
    record.previousValidityMinutes,
    record.newValidityMinutes,
    record.deltaMinutes,
    record.direction,
    record.result,
    wibTime(record.changedAt),
    record.actorOpenId,
    record.scope,
  ])}</tr>`).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>StoreOS QR Policy Audit</title><style>body{font-family:Arial,sans-serif;color:#17251f;font-size:10px;padding:24px}h1{font-size:18px;margin:0 0 6px}p{margin:3px 0}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #cbd8d0;padding:5px;vertical-align:top;text-align:left;word-break:break-word}th{background:#edf6f0;font-size:8px}</style></head><body><h1>StoreOS QR Policy Audit Snapshot</h1><p><strong>Dibuat:</strong> ${escapeHtml(wibTime(audit.generatedAt))}</p><p><strong>Timezone:</strong> Asia/Jakarta</p><p><strong>Scope:</strong> ${escapeHtml(auditScope(audit.filters))}</p><p><strong>Jumlah record:</strong> ${audit.recordCount}</p><p><strong>Integritas:</strong> Export ID, ukuran byte, dan SHA-256 tersedia di metadata protected hasil generasi untuk menjaga hash exact-byte non-self-referential.</p><table><thead><tr>${headers}</tr></thead><tbody>${records || `<tr><td colspan="${POLICY_AUDIT_COLUMNS.length}">Tidak ada event kebijakan untuk filter ini.</td></tr>`}</tbody></table></body></html>`;
}

function filenameFor(audit: GovernanceAuditQrPolicyAuditExport, format: GovernanceAuditQrPolicyAuditFormat) {
  return `storeos-qr-policy-audit-${audit.filters.startDate ?? "all"}-${audit.filters.endDate ?? "all"}-${audit.filters.direction ?? "all"}.${format}`;
}

export async function generateGovernanceAuditQrPolicyAuditArtifact(
  ownerOpenId: string,
  filters: GovernanceAuditQrPolicyAuditFilters,
  format: GovernanceAuditQrPolicyAuditFormat,
  generatedAt = new Date(),
): Promise<GovernanceAuditQrPolicyAuditArtifact> {
  const audit = await getGovernanceAuditQrPolicyAuditExport(ownerOpenId, filters, generatedAt);
  const bytes = format === "csv"
    ? buildGovernanceAuditQrPolicyAuditCsvBytes(audit)
    : printableMonthlyHtmlToPdf(buildGovernanceAuditQrPolicyAuditPrintableHtml(audit), {
      title: "StoreOS QR Policy Audit Snapshot",
      subject: "Read-only owner-admin QR expiry-policy audit export",
      creationDate: audit.generatedAt,
    });
  const sha256 = hashExactGovernanceAuditBytes(bytes);
  return {
    kind: "storeos_governance_qr_policy_audit_export",
    version: 1,
    exportId: `storeos-qr-policy-audit-${format}-${sha256}`,
    format,
    filename: filenameFor(audit, format),
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

export function verifyGovernanceAuditQrPolicyAuditBytes(exportId: string, bytesBase64: string): GovernanceAuditQrPolicyAuditVerification {
  const match = /^storeos-qr-policy-audit-(csv|pdf)-([a-f0-9]{64})$/.exec(exportId);
  if (!match) throw new Error("Invalid QR policy audit export identifier");
  const bytes = decodeExactGovernanceAuditBytes(bytesBase64);
  if (!bytes.length || bytes.byteLength > MAX_VERIFICATION_BYTES) throw new Error("Invalid QR policy audit export bytes");
  const actualSha256 = hashExactGovernanceAuditBytes(bytes);
  const expectedSha256 = match[2];
  return {
    exportId,
    format: match[1] as GovernanceAuditQrPolicyAuditFormat,
    expectedSha256,
    actualSha256,
    byteSize: bytes.byteLength,
    status: actualSha256 === expectedSha256 ? "verified" : "hash_mismatch",
    verified: actualSha256 === expectedSha256,
  };
}
