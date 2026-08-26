import { createHash } from "crypto";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";
import {
  getMonthlyReportArtifactGovernanceAuditExport,
  type ArtifactKind,
  type ArtifactLifecycleStatus,
  type GovernanceAuditArtifactScope,
  type GovernanceAuditExport,
  type GovernanceAuditExportFilters,
} from "./monthlyReportArtifacts";

export type GovernanceAuditExportFormat = "csv" | "pdf";

export type GovernanceAuditGeneratedArtifact = {
  kind: "storeos_governance_lifecycle_audit_export";
  version: 1;
  exportId: string;
  format: GovernanceAuditExportFormat;
  filename: string;
  contentType: "text/csv;charset=utf-8" | "application/pdf";
  generatedAt: Date;
  timezone: "Asia/Jakarta";
  filters: GovernanceAuditExport["filters"];
  scope: string;
  recordCount: number;
  byteSize: number;
  sha256: string;
  bytesBase64: string;
};

export type GovernanceAuditExportVerification = {
  exportId: string;
  format: GovernanceAuditExportFormat;
  expectedSha256: string;
  actualSha256: string;
  byteSize: number;
  status: "verified" | "hash_mismatch";
  verified: boolean;
};

const AUDIT_COLUMNS = [
  "Tahun", "Bulan", "Timezone", "Lifecycle event", "Timestamp event (WIB)", "Sumber event", "Aktor / owner", "Format snapshot", "Format event", "Ukuran byte", "SHA-256 snapshot", "Status snapshot", "Status artefak", "Lifecycle saat ini", "Eligible sejak (WIB)", "Diarsipkan (WIB)", "Retired (WIB)", "Alasan arsip", "Metadata transisi",
];
const MAX_VERIFICATION_BYTES = 10 * 1024 * 1024;

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function wibTime(value: Date | string | null) {
  return value ? `${new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB` : "";
}

function escapeCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function valueOrAll(value: string | number | null) {
  return value === null ? "Semua" : String(value);
}

function auditScope(filters: GovernanceAuditExport["filters"]) {
  return [
    `periode=${filters.year === null ? "semua" : `${filters.year}-${filters.month === null ? "semua" : String(filters.month).padStart(2, "0")}`}`,
    `lifecycle=${filters.lifecycleStatus ?? "semua"}`,
    `format=${filters.artifactFormat ?? "semua"}`,
    `status artefak=${filters.artifactScope ?? "semua"}`,
  ].join("; ");
}

function csvRows(audit: GovernanceAuditExport) {
  const rows: Array<Array<string | number | null>> = [
    ["StoreOS Governance Lifecycle Audit Export", `v${audit.version}`],
    ["Jenis laporan", "Governance / Lifecycle Audit"],
    ["Generated At (Asia/Jakarta)", wibTime(audit.generatedAt)],
    ["Timezone", audit.timezone],
    ["Filter tahun", valueOrAll(audit.filters.year)],
    ["Filter bulan", valueOrAll(audit.filters.month)],
    ["Filter lifecycle", valueOrAll(audit.filters.lifecycleStatus)],
    ["Filter format", valueOrAll(audit.filters.artifactFormat)],
    ["Filter status artefak", valueOrAll(audit.filters.artifactScope)],
    ["Jumlah record", audit.recordCount],
    [],
    AUDIT_COLUMNS,
    ...audit.records.map((record) => [
      record.reportPeriod.year,
      record.reportPeriod.month,
      record.reportPeriod.timezone,
      record.lifecycleStatus,
      wibTime(record.occurredAt),
      record.source,
      record.actor,
      record.artifactFormat,
      record.eventArtifactFormat,
      record.bytes,
      record.sha256,
      record.integritySnapshotStatus,
      record.artifactScope,
      record.currentLifecycleStatus,
      wibTime(record.archiveEligibleAt),
      wibTime(record.archivedAt),
      wibTime(record.retiredAt),
      record.archiveReason,
      record.transitionReason,
    ]),
  ];
  return rows.map((row) => [...row, ...Array.from({ length: AUDIT_COLUMNS.length - row.length }, () => "")]);
}

export function buildGovernanceAuditCsvBytes(audit: GovernanceAuditExport) {
  return Buffer.from(`\uFEFF${csvRows(audit).map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildGovernanceAuditPrintableHtml(audit: GovernanceAuditExport) {
  const cells = (values: Array<string | number | null | undefined>, tag = "td") => values.map((value) => `<${tag}>${escapeHtml(value)}</${tag}>`).join("");
  const headers = cells(AUDIT_COLUMNS, "th");
  const records = audit.records.map((record) => `<tr>${cells([
    record.reportPeriod.year,
    record.reportPeriod.month,
    record.reportPeriod.timezone,
    record.lifecycleStatus,
    wibTime(record.occurredAt),
    record.source,
    record.actor,
    record.artifactFormat,
    record.eventArtifactFormat,
    record.bytes,
    record.sha256,
    record.integritySnapshotStatus,
    record.artifactScope,
    record.currentLifecycleStatus,
    wibTime(record.archiveEligibleAt),
    wibTime(record.archivedAt),
    wibTime(record.retiredAt),
    record.archiveReason,
    record.transitionReason,
  ])}</tr>`).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>StoreOS Governance Audit</title><style>body{font-family:Arial,sans-serif;color:#17251f;font-size:10px;padding:24px}h1{font-size:18px;margin:0 0 6px}p{margin:3px 0}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #cbd8d0;padding:5px;vertical-align:top;text-align:left;word-break:break-word}th{background:#edf6f0;font-size:8px}</style></head><body><h1>StoreOS Governance Lifecycle Audit</h1><p><strong>Dibuat:</strong> ${escapeHtml(wibTime(audit.generatedAt))}</p><p><strong>Timezone:</strong> Asia/Jakarta</p><p><strong>Scope:</strong> ${escapeHtml(auditScope(audit.filters))}</p><p><strong>Jumlah record:</strong> ${audit.recordCount}</p><table><thead><tr>${headers}</tr></thead><tbody>${records || `<tr><td colspan="${AUDIT_COLUMNS.length}">Tidak ada event lifecycle untuk filter ini.</td></tr>`}</tbody></table></body></html>`;
}

function filenameFor(audit: GovernanceAuditExport, format: GovernanceAuditExportFormat) {
  const year = audit.filters.year ?? "all";
  const month = audit.filters.month === null ? "all" : String(audit.filters.month).padStart(2, "0");
  const lifecycle = audit.filters.lifecycleStatus ?? "all";
  const artifactFormat = audit.filters.artifactFormat ?? "all";
  const scope = audit.filters.artifactScope ?? "all";
  return `storeos-governance-audit-${year}-${month}-${lifecycle}-${artifactFormat}-${scope}.${format}`;
}

export async function generateGovernanceAuditExportArtifact(
  ownerOpenId: string,
  filters: GovernanceAuditExportFilters,
  format: GovernanceAuditExportFormat,
  generatedAt = new Date(),
): Promise<GovernanceAuditGeneratedArtifact> {
  const audit = await getMonthlyReportArtifactGovernanceAuditExport(ownerOpenId, filters, generatedAt);
  const bytes = format === "csv"
    ? buildGovernanceAuditCsvBytes(audit)
    : printableMonthlyHtmlToPdf(buildGovernanceAuditPrintableHtml(audit), {
      title: "StoreOS Governance Lifecycle Audit",
      subject: "Read-only owner-admin governance lifecycle audit export",
      creationDate: audit.generatedAt,
    });
  const checksum = sha256(bytes);
  return {
    kind: "storeos_governance_lifecycle_audit_export",
    version: 1,
    exportId: `storeos-governance-audit-${format}-${checksum}`,
    format,
    filename: filenameFor(audit, format),
    contentType: format === "csv" ? "text/csv;charset=utf-8" : "application/pdf",
    generatedAt: audit.generatedAt,
    timezone: audit.timezone,
    filters: audit.filters,
    scope: auditScope(audit.filters),
    recordCount: audit.recordCount,
    byteSize: bytes.byteLength,
    sha256: checksum,
    bytesBase64: bytes.toString("base64"),
  };
}

function decodeBase64Strict(value: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("Invalid governance audit export bytes");
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.byteLength > MAX_VERIFICATION_BYTES || bytes.toString("base64") !== value) {
    throw new Error("Invalid governance audit export bytes");
  }
  return bytes;
}

export function verifyGovernanceAuditExportBytes(exportId: string, bytesBase64: string): GovernanceAuditExportVerification {
  const match = /^storeos-governance-audit-(csv|pdf)-([a-f0-9]{64})$/.exec(exportId);
  if (!match) throw new Error("Invalid governance audit export identifier");
  const bytes = decodeBase64Strict(bytesBase64);
  const actualSha256 = sha256(bytes);
  const expectedSha256 = match[2];
  return {
    exportId,
    format: match[1] as GovernanceAuditExportFormat,
    expectedSha256,
    actualSha256,
    byteSize: bytes.byteLength,
    status: actualSha256 === expectedSha256 ? "verified" : "hash_mismatch",
    verified: actualSha256 === expectedSha256,
  };
}

export type { ArtifactKind, ArtifactLifecycleStatus, GovernanceAuditArtifactScope };
