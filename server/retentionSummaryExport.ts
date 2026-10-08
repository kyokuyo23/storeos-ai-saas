import { createHash } from "node:crypto";
import { z } from "zod";
import { getRetentionSummaryExportIndex, indexRetentionSummaryExport } from "./db";
import {
  canAccessMonthlyReportArtifacts,
  getMonthlyReportActiveArtifactSummary,
  type ArtifactKind,
  type MonthlyReportActiveArtifactSummaryInput,
} from "./monthlyReportArtifacts";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";
import { storageGetBytes, storagePut } from "./storage";

/**
 * Phase 2.23 — Retention Summary Export.
 *
 * Read-only governance snapshot. Retention classification is NOT re-implemented here:
 * every number comes from the authoritative `getMonthlyReportActiveArtifactSummary`
 * (which uses `classifyMonthlyReportArtifactRetention`). This module only serializes
 * that snapshot, hashes the exact final bytes, stores them via the existing storage
 * abstraction, and indexes metadata. It never touches lifecycle, retention policy,
 * archive state, scheduler, Financial Core, Inventory Intelligence, or QR state.
 */

export type RetentionSummaryExportFormat = "csv" | "html" | "pdf";
export type RetentionSummaryClassification = "NORMAL" | "APPROACHING_THRESHOLD" | "ELIGIBLE_FOR_ARCHIVE";
export type RetentionSummaryVerificationStatus = "VERIFIED" | "MISMATCH" | "NOT_FOUND" | "UNAUTHORIZED";
export type RetentionSummaryNotFoundReason = "export_not_found" | "artifact_bytes_unavailable";

type OwnerUser = { openId: string; role: string };

export const RETENTION_SUMMARY_EXPORT_FORMATS = ["csv", "html", "pdf"] as const;
const EXPORT_ID_PATTERN = /^storeos-retention-summary-(csv|html|pdf)-([a-f0-9]{64})$/;
const MAX_STORED_EXPORT_BYTES = 10 * 1024 * 1024;
const CONTENT_TYPE: Record<RetentionSummaryExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  html: "text/html;charset=utf-8",
  pdf: "application/pdf",
};
const FORMAT_LABEL: Record<RetentionSummaryExportFormat, string> = { csv: "CSV", html: "HTML", pdf: "PDF" };
const CLASSIFICATION_LABEL: Record<RetentionSummaryClassification, string> = {
  NORMAL: "Normal",
  APPROACHING_THRESHOLD: "Mendekati batas retensi",
  ELIGIBLE_FOR_ARCHIVE: "Memenuhi syarat arsip",
};

const candidateSchema = z.object({
  classification: z.enum(["APPROACHING_THRESHOLD", "ELIGIBLE_FOR_ARCHIVE"]),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  generatedAt: z.string(),
  archiveEligibleAt: z.string(),
});
const perFormatSchema = z.object({ active: z.number().int(), normal: z.number().int(), approachingThreshold: z.number().int(), eligibleForArchive: z.number().int() });
const snapshotSchema = z.object({
  version: z.literal(1),
  scope: z.string(),
  timezone: z.literal("Asia/Jakarta"),
  evaluatedAt: z.string(),
  review: z.object({
    preset: z.string().nullable(),
    label: z.string().nullable(),
    startDate: z.string(),
    endDate: z.string(),
    startWib: z.string().nullable(),
    endWib: z.string().nullable(),
    calendarPeriodCount: z.number().int(),
    boundary: z.literal("start_inclusive_end_exclusive_wib"),
  }),
  summary: z.object({ totalActive: z.number().int(), normal: z.number().int(), approachingThreshold: z.number().int(), eligibleForArchive: z.number().int() }),
  formatBreakdown: z.object({ csv: perFormatSchema, html: perFormatSchema, pdf: perFormatSchema }),
  oldestCandidate: candidateSchema.nullable(),
  retentionThreshold: z.object({ value: z.number().int(), unit: z.literal("months"), warningWindowDays: z.number().int() }),
});

export type RetentionSummarySnapshot = z.infer<typeof snapshotSchema>;

export type RetentionSummaryExportRecord = {
  exportId: string;
  scope: string;
  format: RetentionSummaryExportFormat;
  filename: string;
  contentType: string;
  evaluatedAt: Date;
  timezone: "Asia/Jakarta";
  review: RetentionSummarySnapshot["review"];
  summary: RetentionSummarySnapshot["summary"];
  formatBreakdown: RetentionSummarySnapshot["formatBreakdown"];
  oldestCandidate: RetentionSummarySnapshot["oldestCandidate"];
  retentionThreshold: RetentionSummarySnapshot["retentionThreshold"];
  byteSize: number;
  sha256: string;
  availability: "available";
};

export type CreateRetentionSummaryExportResult =
  | { outcome: "empty"; evaluatedAt: Date; timezone: "Asia/Jakarta"; review: { label: string | null; startWib: string | null; endWib: string | null; calendarPeriodCount: number } }
  | { outcome: "created" | "already_exported"; export: RetentionSummaryExportRecord; bytesBase64: string };

export type RetentionSummaryVerificationResult = {
  status: RetentionSummaryVerificationStatus;
  exportId: string;
  reason?: RetentionSummaryNotFoundReason;
  format?: RetentionSummaryExportFormat;
  expectedSha256?: string;
  actualSha256?: string;
  expectedByteSize?: number;
  actualByteSize?: number;
};

export type GetRetentionSummaryExportResult =
  | { status: "AVAILABLE"; export: RetentionSummaryExportRecord; bytesBase64: string }
  | { status: "MISMATCH" | "NOT_FOUND" | "UNAUTHORIZED"; exportId: string; reason?: RetentionSummaryNotFoundReason };

/** Exact-byte SHA-256 primitive (same algorithm as every other governance export). */
export function hashExactRetentionSummaryBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Deterministic, locale-independent Jakarta/WIB rendering: `YYYY-MM-DD HH:mm:ss WIB`. */
export function formatRetentionSummaryWib(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")} WIB`;
}

/** Opaque, stable scope identifier; never exposes the raw owner identity. */
export function retentionSummaryScopeId(ownerOpenId: string) {
  return `owner-scope:${createHash("sha256").update(ownerOpenId).digest("hex").slice(0, 12)}`;
}

function oldestCandidateFrom(summary: Awaited<ReturnType<typeof getMonthlyReportActiveArtifactSummary>>): RetentionSummarySnapshot["oldestCandidate"] {
  const eligible = summary.retention.oldestEligibleArtifact;
  const approaching = summary.retention.oldestApproachingArtifact;
  const pick = eligible ?? approaching;
  if (!pick) return null;
  return {
    classification: eligible ? "ELIGIBLE_FOR_ARCHIVE" : "APPROACHING_THRESHOLD",
    year: pick.year,
    month: pick.month,
    generatedAt: pick.generatedAt.toISOString(),
    archiveEligibleAt: pick.archiveEligibleAt.toISOString(),
  };
}

/**
 * Every active bundle contains exactly one CSV, HTML and PDF (a bundle is counted active
 * only when all three verify), so each format carries the bundle count of each class.
 */
export function buildRetentionSummarySnapshot(
  ownerOpenId: string,
  summary: Awaited<ReturnType<typeof getMonthlyReportActiveArtifactSummary>>,
  evaluatedAt: Date,
): RetentionSummarySnapshot {
  const bundles = {
    normal: summary.retention.normalArtifactCount / 3,
    approaching: summary.retention.approachingArtifactCount / 3,
    eligible: summary.retention.eligibleArtifactCount / 3,
  };
  const perFormat = (kind: ArtifactKind) => ({
    active: summary.artifactTypeCounts[kind],
    normal: bundles.normal,
    approachingThreshold: bundles.approaching,
    eligibleForArchive: bundles.eligible,
  });
  return {
    version: 1,
    scope: retentionSummaryScopeId(ownerOpenId),
    timezone: "Asia/Jakarta",
    evaluatedAt: evaluatedAt.toISOString(),
    review: {
      preset: summary.range.preset,
      label: summary.range.label,
      startDate: summary.range.startDate ?? "",
      endDate: summary.range.endDate ?? "",
      startWib: summary.range.startWib,
      endWib: summary.range.endWib,
      calendarPeriodCount: summary.calendarPeriodCount,
      boundary: summary.range.boundary,
    },
    summary: {
      totalActive: summary.activeArtifactCount,
      normal: summary.retention.normalArtifactCount,
      approachingThreshold: summary.retention.approachingArtifactCount,
      eligibleForArchive: summary.retention.eligibleArtifactCount,
    },
    formatBreakdown: { csv: perFormat("csv"), html: perFormat("html"), pdf: perFormat("pdf") },
    oldestCandidate: oldestCandidateFrom(summary),
    retentionThreshold: { value: summary.retention.retentionMonths, unit: "months", warningWindowDays: summary.retention.archiveWarningWindowDays },
  };
}

type Row = [section: string, key: string, value: string | number];
export const RETENTION_SUMMARY_CSV_HEADER = ["Bagian", "Kunci", "Nilai"] as const;

/** Single source of rows: CSV, HTML and PDF are all rendered from this list (FR-005). */
export function retentionSummaryRows(snapshot: RetentionSummarySnapshot): Row[] {
  const rows: Row[] = [
    ["Metadata", "Jenis laporan", "StoreOS Retention Summary Export"],
    ["Metadata", "Versi", snapshot.version],
    ["Metadata", "Scope", snapshot.scope],
    ["Periode review", "Preset", snapshot.review.label ?? "Rentang kustom"],
    ["Periode review", "Mulai (WIB, inklusif)", snapshot.review.startWib ?? ""],
    ["Periode review", "Akhir (WIB, eksklusif)", snapshot.review.endWib ?? ""],
    ["Periode review", "Jumlah periode kalender", snapshot.review.calendarPeriodCount],
    ["Evaluasi", "Waktu evaluasi", formatRetentionSummaryWib(snapshot.evaluatedAt)],
    ["Evaluasi", "Timezone", snapshot.timezone],
    ["Klasifikasi", "Total artefak aktif", snapshot.summary.totalActive],
    ["Klasifikasi", `${CLASSIFICATION_LABEL.NORMAL} (NORMAL)`, snapshot.summary.normal],
    ["Klasifikasi", `${CLASSIFICATION_LABEL.APPROACHING_THRESHOLD} (APPROACHING_THRESHOLD)`, snapshot.summary.approachingThreshold],
    ["Klasifikasi", `${CLASSIFICATION_LABEL.ELIGIBLE_FOR_ARCHIVE} (ELIGIBLE_FOR_ARCHIVE)`, snapshot.summary.eligibleForArchive],
  ];
  for (const format of RETENTION_SUMMARY_EXPORT_FORMATS) {
    const entry = snapshot.formatBreakdown[format];
    rows.push(
      ["Rincian format", `${FORMAT_LABEL[format]} · Aktif`, entry.active],
      ["Rincian format", `${FORMAT_LABEL[format]} · Normal`, entry.normal],
      ["Rincian format", `${FORMAT_LABEL[format]} · Mendekati batas retensi`, entry.approachingThreshold],
      ["Rincian format", `${FORMAT_LABEL[format]} · Memenuhi syarat arsip`, entry.eligibleForArchive],
    );
  }
  rows.push(
    ["Konteks retensi", "Ambang retensi", `${snapshot.retentionThreshold.value} bulan`],
    ["Konteks retensi", "Jendela peringatan", `${snapshot.retentionThreshold.warningWindowDays} hari`],
  );
  if (snapshot.oldestCandidate) {
    const candidate = snapshot.oldestCandidate;
    rows.push(
      ["Konteks retensi", "Kandidat tertua · Klasifikasi", `${CLASSIFICATION_LABEL[candidate.classification]} (${candidate.classification})`],
      ["Konteks retensi", "Kandidat tertua · Periode laporan", `${candidate.year}-${String(candidate.month).padStart(2, "0")}`],
      ["Konteks retensi", "Kandidat tertua · Dibuat", formatRetentionSummaryWib(candidate.generatedAt)],
      ["Konteks retensi", "Kandidat tertua · Memenuhi syarat arsip sejak", formatRetentionSummaryWib(candidate.archiveEligibleAt)],
    );
  } else {
    rows.push(["Konteks retensi", "Kandidat tertua", "Tidak ada"]);
  }
  rows.push(["Catatan", "Sifat snapshot", "Read-only. Tidak mengubah lifecycle, kebijakan retensi, status arsip, atau data bisnis."]);
  return rows;
}

function escapeCsvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function buildRetentionSummaryCsvBytes(snapshot: RetentionSummarySnapshot) {
  const lines = [RETENTION_SUMMARY_CSV_HEADER as readonly (string | number)[], ...retentionSummaryRows(snapshot)];
  return Buffer.from(`﻿${lines.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

function escapeHtml(value: string | number) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildRetentionSummaryHtml(snapshot: RetentionSummarySnapshot) {
  const body = retentionSummaryRows(snapshot).map(([section, key, value]) => `<tr><td>${escapeHtml(section)}</td><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StoreOS Retention Summary Export</title><style>body{font-family:Arial,sans-serif;color:#17251f;font-size:12px;padding:24px}h1{font-size:18px;margin:0 0 6px}p{margin:3px 0}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #cbd8d0;padding:6px;vertical-align:top;text-align:left;word-break:break-word}th{background:#edf6f0}@media print{body{padding:0}tr{page-break-inside:avoid}}</style></head><body><h1>StoreOS Retention Summary Export</h1><p><strong>Waktu evaluasi:</strong> ${escapeHtml(formatRetentionSummaryWib(snapshot.evaluatedAt))}</p><p><strong>Timezone:</strong> Asia/Jakarta</p><table><thead><tr>${RETENTION_SUMMARY_CSV_HEADER.map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function buildRetentionSummaryPdfBytes(snapshot: RetentionSummarySnapshot) {
  const html = buildRetentionSummaryHtml(snapshot);
  return printableMonthlyHtmlToPdf(html, {
    title: "StoreOS Retention Summary Export",
    subject: "Read-only owner-admin retention summary snapshot",
    creationDate: new Date(snapshot.evaluatedAt),
    // Deterministic trailer ID so identical snapshots produce identical bytes.
    fileId: createHash("sha256").update(html).digest("hex").slice(0, 32).toUpperCase(),
  });
}

export function buildRetentionSummaryBytes(snapshot: RetentionSummarySnapshot, format: RetentionSummaryExportFormat) {
  if (format === "csv") return buildRetentionSummaryCsvBytes(snapshot);
  if (format === "html") return Buffer.from(buildRetentionSummaryHtml(snapshot), "utf8");
  return buildRetentionSummaryPdfBytes(snapshot);
}

function filenameFor(snapshot: RetentionSummarySnapshot, format: RetentionSummaryExportFormat) {
  const stamp = formatRetentionSummaryWib(snapshot.evaluatedAt).slice(0, 10);
  return `storeos-retention-summary-${snapshot.review.startDate || "range"}-${snapshot.review.endDate || "range"}-${stamp}.${format}`;
}

function exportIdFor(format: RetentionSummaryExportFormat, sha256: string) {
  return `storeos-retention-summary-${format}-${sha256}`;
}

function parseExportId(exportId: string) {
  const match = EXPORT_ID_PATTERN.exec(exportId);
  return match ? { format: match[1] as RetentionSummaryExportFormat, sha256: match[2] } : null;
}

type IndexRow = NonNullable<Awaited<ReturnType<typeof getRetentionSummaryExportIndex>>>;

function recordFromIndexRow(row: IndexRow): RetentionSummaryExportRecord {
  const parsed = snapshotSchema.safeParse(JSON.parse(row.snapshotJson));
  if (!parsed.success) throw new Error("Metadata ekspor ringkasan retensi tidak valid.");
  const snapshot = parsed.data;
  const format = row.format as RetentionSummaryExportFormat;
  return {
    exportId: row.exportId,
    scope: snapshot.scope,
    format,
    filename: filenameFor(snapshot, format),
    contentType: CONTENT_TYPE[format],
    evaluatedAt: row.evaluatedAt,
    timezone: "Asia/Jakarta",
    review: snapshot.review,
    summary: snapshot.summary,
    formatBreakdown: snapshot.formatBreakdown,
    oldestCandidate: snapshot.oldestCandidate,
    retentionThreshold: snapshot.retentionThreshold,
    byteSize: row.byteSize,
    sha256: row.sha256,
    availability: "available",
  };
}

function assertOwner(user: OwnerUser | null | undefined): asserts user is OwnerUser {
  if (!canAccessMonthlyReportArtifacts(user)) throw new Error("Akses ekspor ringkasan retensi dibatasi untuk pemilik StoreOS.");
}

/**
 * Creates the snapshot, serializes it, hashes the exact final bytes, stores them through the
 * existing storage abstraction, then indexes metadata. Empty scopes create nothing (PRD §13).
 */
export async function createRetentionSummaryExport(
  user: OwnerUser | null | undefined,
  input: MonthlyReportActiveArtifactSummaryInput,
  format: RetentionSummaryExportFormat,
  now = new Date(),
): Promise<CreateRetentionSummaryExportResult> {
  assertOwner(user);
  if (!RETENTION_SUMMARY_EXPORT_FORMATS.includes(format)) throw new Error("Format ekspor ringkasan retensi tidak valid.");
  // Server clock only (FR-003); truncated to whole seconds so rendered text and metadata agree.
  const evaluatedAt = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const summary = await getMonthlyReportActiveArtifactSummary(user.openId, input, evaluatedAt);
  if (summary.activeArtifactCount === 0) {
    return { outcome: "empty", evaluatedAt, timezone: "Asia/Jakarta", review: { label: summary.range.label, startWib: summary.range.startWib, endWib: summary.range.endWib, calendarPeriodCount: summary.calendarPeriodCount } };
  }
  const snapshot = buildRetentionSummarySnapshot(user.openId, summary, evaluatedAt);
  const bytes = buildRetentionSummaryBytes(snapshot, format);
  const sha256 = hashExactRetentionSummaryBytes(bytes);
  const exportId = exportIdFor(format, sha256);
  const bytesBase64 = bytes.toString("base64");

  const existing = await getRetentionSummaryExportIndex(user.openId, exportId);
  if (existing) return { outcome: "already_exported", export: recordFromIndexRow(existing), bytesBase64 };

  const scopeHash = snapshot.scope.replace("owner-scope:", "");
  const stored = await storagePut(`retention-summary-exports/${scopeHash}/${exportId}.${format}`, bytes, CONTENT_TYPE[format]);
  const indexed = await indexRetentionSummaryExport({
    ownerOpenId: user.openId,
    exportId,
    format,
    storageKey: stored.key,
    sha256,
    byteSize: bytes.byteLength,
    evaluatedAt,
    scopeLabel: snapshot.scope,
    datePreset: snapshot.review.preset,
    rangeStartDate: snapshot.review.startDate,
    rangeEndDate: snapshot.review.endDate,
    snapshotJson: JSON.stringify(snapshot),
  });
  return { outcome: "created", export: recordFromIndexRow(indexed.record), bytesBase64 };
}

type LoadedBytes =
  | { kind: "unknown" }
  | { kind: "unavailable"; row: IndexRow }
  | { kind: "loaded"; row: IndexRow; data: Buffer; actualSha256: string };

async function loadStoredExportBytes(ownerOpenId: string, exportId: string): Promise<LoadedBytes> {
  const parsedId = parseExportId(exportId);
  if (!parsedId) return { kind: "unknown" };
  // Authorization/scope is applied in the query itself: another owner's row is never read.
  const row = await getRetentionSummaryExportIndex(ownerOpenId, exportId);
  if (!row) return { kind: "unknown" };
  try {
    const { data } = await storageGetBytes(row.storageKey);
    if (data.byteLength > MAX_STORED_EXPORT_BYTES) return { kind: "loaded", row, data, actualSha256: "oversized" };
    return { kind: "loaded", row, data, actualSha256: hashExactRetentionSummaryBytes(data) };
  } catch (error) {
    if ((error as { code?: string }).code === "STORAGE_NOT_FOUND") return { kind: "unavailable", row };
    throw new Error("Penyimpanan ekspor ringkasan retensi tidak dapat diakses. Silakan coba lagi.");
  }
}

function hashesAgree(row: IndexRow, actualSha256: string, actualBytes: number) {
  const idHash = parseExportId(row.exportId)?.sha256;
  return actualSha256 === row.sha256 && actualSha256 === idHash && actualBytes === row.byteSize;
}

/** Protected verification: authorize first, then read exact stored bytes and recompute SHA-256. Never mutates or repairs. */
export async function verifyRetentionSummaryExport(user: OwnerUser | null | undefined, exportId: string): Promise<RetentionSummaryVerificationResult> {
  if (!user || !canAccessMonthlyReportArtifacts(user)) return { status: "UNAUTHORIZED", exportId };
  const loaded = await loadStoredExportBytes(user.openId, exportId);
  if (loaded.kind === "unknown") return { status: "NOT_FOUND", exportId, reason: "export_not_found" };
  if (loaded.kind === "unavailable") {
    return { status: "NOT_FOUND", exportId, reason: "artifact_bytes_unavailable", format: loaded.row.format as RetentionSummaryExportFormat, expectedSha256: loaded.row.sha256, expectedByteSize: loaded.row.byteSize };
  }
  const { row, data, actualSha256 } = loaded;
  return {
    status: hashesAgree(row, actualSha256, data.byteLength) ? "VERIFIED" : "MISMATCH",
    exportId,
    format: row.format as RetentionSummaryExportFormat,
    expectedSha256: row.sha256,
    actualSha256,
    expectedByteSize: row.byteSize,
    actualByteSize: data.byteLength,
  };
}

/** Download path: bytes are served only when they still match the stored hash. */
export async function getRetentionSummaryExport(user: OwnerUser | null | undefined, exportId: string): Promise<GetRetentionSummaryExportResult> {
  if (!user || !canAccessMonthlyReportArtifacts(user)) return { status: "UNAUTHORIZED", exportId };
  const loaded = await loadStoredExportBytes(user.openId, exportId);
  if (loaded.kind === "unknown") return { status: "NOT_FOUND", exportId, reason: "export_not_found" };
  if (loaded.kind === "unavailable") return { status: "NOT_FOUND", exportId, reason: "artifact_bytes_unavailable" };
  if (!hashesAgree(loaded.row, loaded.actualSha256, loaded.data.byteLength)) return { status: "MISMATCH", exportId };
  return { status: "AVAILABLE", export: recordFromIndexRow(loaded.row), bytesBase64: loaded.data.toString("base64") };
}

