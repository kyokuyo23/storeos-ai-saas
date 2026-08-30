import { createHash } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { monthlyReportArtifactLifecycleEvents, monthlyReportArtifacts } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetBytes, storagePut } from "./storage";
import { ENV } from "./_core/env";
import type { AutomatedMonthlyReportArtifacts } from "./automatedMonthlyReports";
import { governanceAuditWibStart, resolveGovernanceAuditDateRange, type GovernanceAuditDateSearchFilters, type GovernanceAuditResolvedDateRange } from "./governanceAuditDateSearch";

export type MonthlyReport = AutomatedMonthlyReportArtifacts;
export const LEGACY_ARTIFACT_SCOPE = "legacy-single-store";
export const DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS = 24;
export const ARCHIVE_WARNING_WINDOW_DAYS = 90;
export type ArtifactKind = "csv" | "html" | "pdf";
export type ArtifactLifecycleStatus = "generated" | "verified" | "retained" | "eligible_for_archive" | "archived";
export type ArtifactIntegrityStatus = "available" | "missing" | "corrupt" | "retired" | "archived";
export type ArtifactRetentionStatus = "normal" | "approaching" | "eligible";
type MonthlyReportDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type StoredMonthlyReportArtifact = {
  id: number;
  ownerOpenId: string;
  year: number;
  month: number;
  timezone: string;
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: Date;
  csv: { key: string; url: string; sha256: string; bytes: number };
  printableHtml: { key: string; url: string; sha256: string; bytes: number };
  pdf: { key: string; url: string; sha256: string; bytes: number };
  lifecycleStatus: ArtifactLifecycleStatus;
  verifiedAt: Date | null;
  retainedAt: Date | null;
  archiveEligibleAt: Date | null;
  archivedAt: Date | null;
  archiveReason: string | null;
  retiredAt: Date | null;
  createdAt: Date;
};

export type ArtifactAvailability = {
  kind: ArtifactKind;
  bytes: number;
  sha256: string;
  status: ArtifactIntegrityStatus;
};

export type ArtifactLifecycleEvent = {
  reportPeriod: { year: number; month: number; timezone: string };
  lifecycleStatus: ArtifactLifecycleStatus;
  occurredAt: Date;
  reason: string | null;
  actor: string;
  source: string;
  artifactFormat: string;
  integrity: Array<{ kind: ArtifactKind; sha256: string; bytes: number }>;
};

export type MonthlyReportArtifactLifecycleHistory = {
  artifact: {
    id: number;
    year: number;
    month: number;
    timezone: string;
    generatedAt: Date;
    lifecycleStatus: ArtifactLifecycleStatus;
    archivedAt: Date | null;
    retiredAt: Date | null;
  };
  events: ArtifactLifecycleEvent[];
};

export type MonthlyReportArtifactGovernanceSummary = {
  retentionMonths: number;
  archiveWarningWindowDays: number;
  retainedArtifactCount: number;
  artifactTypeCounts: Record<ArtifactKind, number>;
  oldestRetainedReport: { year: number; month: number; generatedAt: Date } | null;
  approachingArchive: Array<{ year: number; month: number; generatedAt: Date; lifecycleStatus: ArtifactLifecycleStatus; daysUntilArchive: number }>;
  lifecycleCounts: Record<ArtifactLifecycleStatus, number>;
  integrityCounts: Record<ArtifactIntegrityStatus, number>;
};

export type MonthlyReportActiveArtifactSummaryInput = Pick<GovernanceAuditDateSearchFilters, "startDate" | "endDate" | "datePreset">;

export type MonthlyReportArtifactListFilter = MonthlyReportActiveArtifactSummaryInput & {
  year?: number;
  month?: number;
  format?: ArtifactKind;
  integrity?: "healthy";
  retentionStatus?: ArtifactRetentionStatus;
};

export type MonthlyReportActiveArtifactSummary = {
  timezone: "Asia/Jakarta";
  range: GovernanceAuditResolvedDateRange;
  calendarPeriodCount: number;
  activeArtifactCount: number;
  artifactTypeCounts: Record<ArtifactKind, number>;
  oldestActiveArtifact: { year: number; month: number; generatedAt: Date } | null;
  newestActiveArtifact: { year: number; month: number; generatedAt: Date } | null;
  integrity: {
    verifiedBundleCount: number;
    excludedBundleCount: number;
    availabilityCounts: Record<ArtifactIntegrityStatus, number>;
  };
  retention: {
    retentionMonths: number;
    archiveWarningWindowDays: number;
    evaluatedAt: Date;
    normalArtifactCount: number;
    approachingArtifactCount: number;
    eligibleArtifactCount: number;
    approachingArtifactTypeCounts: Record<ArtifactKind, number>;
    oldestApproachingArtifact: { year: number; month: number; generatedAt: Date; archiveEligibleAt: Date } | null;
  };
};

export type OwnerApprovedArchiveResult = {
  outcome: "archived" | "already_archived" | "not_found" | "not_eligible" | "integrity_failed";
  artifact: { id: number; year: number; month: number; lifecycleStatus: ArtifactLifecycleStatus } | null;
  availability: ArtifactAvailability[];
  archivedAt: Date | null;
};

export type GovernanceAuditArtifactScope = "active" | "archived_or_retired";

export type GovernanceAuditExportFilters = {
  year?: number;
  month?: number;
  lifecycleStatus?: ArtifactLifecycleStatus;
  artifactFormat?: ArtifactKind;
  artifactScope?: GovernanceAuditArtifactScope;
};

export type GovernanceAuditExportRecord = {
  reportPeriod: { year: number; month: number; timezone: string };
  lifecycleStatus: ArtifactLifecycleStatus;
  occurredAt: Date;
  source: string;
  actor: string;
  transitionReason: string | null;
  eventArtifactFormat: string;
  artifactFormat: ArtifactKind | "bundle";
  bytes: number | null;
  sha256: string | null;
  integritySnapshotStatus: "recorded" | "unavailable";
  artifactScope: "active" | "archived" | "retired";
  currentLifecycleStatus: ArtifactLifecycleStatus;
  archiveEligibleAt: Date | null;
  archivedAt: Date | null;
  retiredAt: Date | null;
  archiveReason: string | null;
};

export type GovernanceAuditExport = {
  kind: "storeos_governance_lifecycle_audit";
  version: 1;
  generatedAt: Date;
  timezone: "Asia/Jakarta";
  filters: {
    year: number | null;
    month: number | null;
    lifecycleStatus: ArtifactLifecycleStatus | null;
    artifactFormat: ArtifactKind | null;
    artifactScope: GovernanceAuditArtifactScope | null;
  };
  recordCount: number;
  records: GovernanceAuditExportRecord[];
};

function digest(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

function validatePeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("Invalid report year");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Invalid report month");
}

function defaultArtifactScope() {
  return ENV.ownerOpenId || LEGACY_ARTIFACT_SCOPE;
}

function isAuthorizedOwnerScope(ownerOpenId: string) {
  return ownerOpenId === defaultArtifactScope() || ownerOpenId === LEGACY_ARTIFACT_SCOPE;
}

/** The current StoreOS deployment is a single-store workspace, owned by its admin. */
export function canAccessMonthlyReportArtifacts(user: { openId: string; role: string } | null | undefined) {
  return Boolean(user && user.role === "admin" && user.openId === ENV.ownerOpenId && ENV.ownerOpenId);
}

export function retentionCutoff(now = new Date(), retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS) {
  if (!Number.isInteger(retentionMonths) || retentionMonths < 1 || retentionMonths > 120) {
    throw new Error("Invalid artifact retention period");
  }
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);
  return cutoff;
}

/**
 * Retention indicator only: it reuses the lifecycle cutoff and warning window
 * without changing metadata, lifecycle status, storage, or download behavior.
 */
export function classifyMonthlyReportArtifactRetention(
  artifact: Pick<StoredMonthlyReportArtifact, "generatedAt" | "lifecycleStatus">,
  evaluationNow = new Date(),
  retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS,
): { status: ArtifactRetentionStatus; archiveEligibleAt: Date } {
  const archiveEligibleAt = new Date(artifact.generatedAt);
  archiveEligibleAt.setUTCMonth(archiveEligibleAt.getUTCMonth() + retentionMonths);
  const archiveCutoff = retentionCutoff(evaluationNow, retentionMonths);
  const warningCutoff = new Date(archiveCutoff);
  warningCutoff.setUTCDate(warningCutoff.getUTCDate() + ARCHIVE_WARNING_WINDOW_DAYS);
  if (artifact.lifecycleStatus === "eligible_for_archive" || artifact.generatedAt < archiveCutoff) {
    return { status: "eligible", archiveEligibleAt };
  }
  if (artifact.generatedAt < warningCutoff) return { status: "approaching", archiveEligibleAt };
  return { status: "normal", archiveEligibleAt };
}

function mapArtifact(row: typeof monthlyReportArtifacts.$inferSelect): StoredMonthlyReportArtifact {
  return {
    id: row.id,
    ownerOpenId: row.ownerOpenId || LEGACY_ARTIFACT_SCOPE,
    year: row.year,
    month: row.month,
    timezone: row.timezone,
    periodStartDate: row.periodStartDate,
    periodEndDate: row.periodEndDate,
    generatedAt: row.generatedAt,
    csv: { key: row.csvKey, url: row.csvUrl, sha256: row.csvSha256, bytes: row.csvBytes },
    printableHtml: { key: row.htmlKey, url: row.htmlUrl, sha256: row.htmlSha256, bytes: row.htmlBytes },
    pdf: { key: row.pdfKey, url: row.pdfUrl, sha256: row.pdfSha256, bytes: row.pdfBytes },
    lifecycleStatus: (row.lifecycleStatus || "retained") as ArtifactLifecycleStatus,
    verifiedAt: row.verifiedAt,
    retainedAt: row.retainedAt,
    archiveEligibleAt: row.archiveEligibleAt,
    archivedAt: row.archivedAt,
    archiveReason: row.archiveReason,
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
  };
}

function belongsToOwnerScope(artifact: StoredMonthlyReportArtifact, ownerOpenId: string) {
  return artifact.ownerOpenId === ownerOpenId || artifact.ownerOpenId === LEGACY_ARTIFACT_SCOPE;
}

/** Governance counts never include isolated verification/test objects. */
function isProductionArtifact(artifact: StoredMonthlyReportArtifact) {
  const prefix = `monthly-management-reports/${artifact.year}/${String(artifact.month).padStart(2, "0")}/`;
  return [artifact.csv.key, artifact.printableHtml.key, artifact.pdf.key]
    .every((key) => typeof key === "string" && key.startsWith(prefix) && !key.includes("nonproduction-e2e/") && !key.includes(".."));
}

function isRangeInputComplete(input: MonthlyReportActiveArtifactSummaryInput) {
  if (input.datePreset) return !input.startDate && !input.endDate;
  return Boolean(input.startDate && input.endDate);
}

function countCalendarMonths(range: GovernanceAuditResolvedDateRange) {
  if (!range.startDate || !range.endDate) return 0;
  const [startYear, startMonth] = range.startDate.split("-").map(Number);
  const [endYear, endMonth] = range.endDate.split("-").map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth + 1;
}

/** Includes only report periods whose Jakarta/WIB start is within the resolved inclusive/exclusive range. */
function isArtifactInResolvedRange(artifact: StoredMonthlyReportArtifact, range: GovernanceAuditResolvedDateRange) {
  if (!range.startDate || !range.endWib) return false;
  const artifactStart = governanceAuditWibStart(artifact.periodStartDate).getTime();
  const rangeStart = governanceAuditWibStart(range.startDate).getTime();
  const rangeEnd = new Date(range.endWib.replace(" WIB", "+07:00")).getTime();
  return artifactStart >= rangeStart && artifactStart < rangeEnd;
}

function integritySnapshotFor(artifact: Pick<StoredMonthlyReportArtifact, "csv" | "printableHtml" | "pdf">): Array<{ kind: ArtifactKind; sha256: string; bytes: number }> {
  return [
    { kind: "csv", sha256: artifact.csv.sha256, bytes: artifact.csv.bytes },
    { kind: "html", sha256: artifact.printableHtml.sha256, bytes: artifact.printableHtml.bytes },
    { kind: "pdf", sha256: artifact.pdf.sha256, bytes: artifact.pdf.bytes },
  ];
}

function parseIntegritySnapshot(value: string | null, fallback: StoredMonthlyReportArtifact) {
  if (!value) return integritySnapshotFor(fallback);
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((entry) => entry && typeof entry === "object" && ["csv", "html", "pdf"].includes((entry as { kind?: string }).kind ?? "") && typeof (entry as { sha256?: unknown }).sha256 === "string" && typeof (entry as { bytes?: unknown }).bytes === "number")) {
      return parsed as Array<{ kind: ArtifactKind; sha256: string; bytes: number }>;
    }
  } catch {
    // Legacy or malformed snapshots safely fall back to immutable artifact metadata.
  }
  return integritySnapshotFor(fallback);
}

/** Governance exports preserve the exact transition snapshot; they never recalculate legacy values. */
function parseStoredIntegritySnapshot(value: string | null): Array<{ kind: ArtifactKind; sha256: string; bytes: number }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as { kind?: unknown; sha256?: unknown; bytes?: unknown };
      if (!(["csv", "html", "pdf"] as const).includes(candidate.kind as ArtifactKind) || typeof candidate.sha256 !== "string" || typeof candidate.bytes !== "number") return [];
      return [{ kind: candidate.kind as ArtifactKind, sha256: candidate.sha256, bytes: candidate.bytes }];
    });
  } catch {
    return [];
  }
}

function lifecycleEventKey(status: ArtifactLifecycleStatus, source: string, reason: string | null) {
  return `${status}:${source}:${reason ?? "none"}`.slice(0, 191);
}

async function recordLifecycleEvent(
  db: MonthlyReportDb,
  artifact: StoredMonthlyReportArtifact,
  lifecycleStatus: ArtifactLifecycleStatus,
  occurredAt: Date,
  options: { reason?: string | null; actor?: string; source?: string; artifactFormat?: string } = {},
) {
  const reason = options.reason ?? null;
  const source = options.source ?? "report_governance";
  try {
    await db.insert(monthlyReportArtifactLifecycleEvents).values({
      artifactId: artifact.id,
      ownerOpenId: artifact.ownerOpenId,
      lifecycleStatus,
      occurredAt,
      reason,
      actor: options.actor ?? "storeos-system",
      source,
      artifactFormat: options.artifactFormat ?? "bundle",
      integritySnapshot: JSON.stringify(integritySnapshotFor(artifact)),
      eventKey: lifecycleEventKey(lifecycleStatus, source, reason),
    });
    return true;
  } catch (error) {
    const candidate = error as { code?: string; message?: string };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.message?.includes("Duplicate entry")) return false;
    throw error;
  }
}

export async function getMonthlyReportArtifact(year: number, month: number) {
  validatePeriod(year, month);
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const row = (await db.select().from(monthlyReportArtifacts).where(and(eq(monthlyReportArtifacts.year, year), eq(monthlyReportArtifacts.month, month))).limit(1))[0];
  return row ? mapArtifact(row) : null;
}

export async function getMonthlyReportArtifactForOwner(year: number, month: number, ownerOpenId = defaultArtifactScope()) {
  validatePeriod(year, month);
  if (!isAuthorizedOwnerScope(ownerOpenId)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const row = (await db.select().from(monthlyReportArtifacts).where(and(
    eq(monthlyReportArtifacts.year, year),
    eq(monthlyReportArtifacts.month, month),
    isNull(monthlyReportArtifacts.retiredAt),
    isNull(monthlyReportArtifacts.archivedAt),
  )).limit(5)).find((candidate) => candidate.year === year && candidate.month === month && !candidate.retiredAt && !candidate.archivedAt && (candidate.ownerOpenId === ownerOpenId || candidate.ownerOpenId === LEGACY_ARTIFACT_SCOPE));
  return row ? mapArtifact(row) : null;
}

export async function persistMonthlyReportArtifacts(report: MonthlyReport) {
  validatePeriod(report.report.period.year, report.report.period.month);
  const existing = await getMonthlyReportArtifactForOwner(report.report.period.year, report.report.period.month);
  if (existing) return { created: false as const, artifact: existing };

  const csvBytes = Buffer.byteLength(report.csv, "utf8");
  const htmlBytes = Buffer.byteLength(report.printableHtml, "utf8");
  const pdfBytes = report.pdf.byteLength;
  const csvSha256 = digest(report.csv);
  const htmlSha256 = digest(report.printableHtml);
  const pdfSha256 = digest(report.pdf);
  const prefix = `monthly-management-reports/${report.report.period.year}/${String(report.report.period.month).padStart(2, "0")}`;
  const [csvObject, htmlObject, pdfObject] = await Promise.all([
    storagePut(`${prefix}/report.csv`, report.csv, "text/csv; charset=utf-8"),
    storagePut(`${prefix}/report.html`, report.printableHtml, "text/html; charset=utf-8"),
    storagePut(`${prefix}/report.pdf`, report.pdf, "application/pdf"),
  ]);

  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  try {
    const generatedAt = new Date(report.generatedAt);
    const result = await db.insert(monthlyReportArtifacts).values({
      ownerOpenId: defaultArtifactScope(),
      year: report.report.period.year,
      month: report.report.period.month,
      timezone: report.report.period.timezone,
      periodStartDate: report.report.period.startDate,
      periodEndDate: report.report.period.endDate,
      generatedAt,
      csvKey: csvObject.key,
      csvUrl: csvObject.url,
      csvSha256,
      csvBytes,
      htmlKey: htmlObject.key,
      htmlUrl: htmlObject.url,
      htmlSha256,
      htmlBytes,
      pdfKey: pdfObject.key,
      pdfUrl: pdfObject.url,
      pdfSha256,
      pdfBytes,
      lifecycleStatus: "retained",
      verifiedAt: generatedAt,
      retainedAt: generatedAt,
    });
    const id = Number(result[0].insertId);
    const inserted = (await db.select().from(monthlyReportArtifacts).where(eq(monthlyReportArtifacts.id, id)).limit(1))[0];
    if (!inserted) throw new Error("Monthly report artifact record was not created");
    const artifact = mapArtifact(inserted);
    await recordLifecycleEvent(db, artifact, "generated", generatedAt, { reason: "immutable_artifact_persisted", actor: "monthly-report-generator", source: "report_pipeline" });
    await recordLifecycleEvent(db, artifact, "verified", generatedAt, { reason: "sha256_metadata_recorded", actor: "monthly-report-generator", source: "report_pipeline" });
    await recordLifecycleEvent(db, artifact, "retained", generatedAt, { reason: "within_24_month_retention_window", actor: "monthly-report-generator", source: "report_pipeline" });
    return { created: true as const, artifact };
  } catch (error) {
    // A concurrent invocation may have won the scoped unique-period race. Never overwrite it.
    const winner = await getMonthlyReportArtifactForOwner(report.report.period.year, report.report.period.month);
    if (winner) return { created: false as const, artifact: winner };
    throw error;
  }
}

function fileForKind(artifact: StoredMonthlyReportArtifact, kind: ArtifactKind) {
  if (kind === "html") return artifact.printableHtml;
  return artifact[kind];
}

function keyMatchesArtifactScope(key: string, artifact: StoredMonthlyReportArtifact) {
  const expectedPrefix = `monthly-management-reports/${artifact.year}/${String(artifact.month).padStart(2, "0")}/`;
  return key.startsWith(expectedPrefix) && !key.includes("..");
}

export async function verifyMonthlyReportArtifact(artifact: StoredMonthlyReportArtifact, kind: ArtifactKind): Promise<ArtifactAvailability> {
  const file = fileForKind(artifact, kind);
  if (artifact.archivedAt || artifact.lifecycleStatus === "archived") return { kind, bytes: file.bytes, sha256: file.sha256, status: "archived" };
  if (artifact.retiredAt) return { kind, bytes: file.bytes, sha256: file.sha256, status: "retired" };
  if (!keyMatchesArtifactScope(file.key, artifact)) return { kind, bytes: file.bytes, sha256: file.sha256, status: "corrupt" };
  try {
    const { data } = await storageGetBytes(file.key);
    if (data.byteLength !== file.bytes || digest(data) !== file.sha256) {
      return { kind, bytes: file.bytes, sha256: file.sha256, status: "corrupt" };
    }
    return { kind, bytes: file.bytes, sha256: file.sha256, status: "available" };
  } catch (error) {
    if ((error as { code?: string }).code === "STORAGE_NOT_FOUND") {
      return { kind, bytes: file.bytes, sha256: file.sha256, status: "missing" };
    }
    throw error;
  }
}

export async function readVerifiedMonthlyReportArtifact(year: number, month: number, kind: ArtifactKind, ownerOpenId = defaultArtifactScope()) {
  const artifact = await getMonthlyReportArtifactForOwner(year, month, ownerOpenId);
  if (!artifact) return null;
  const file = fileForKind(artifact, kind);
  const availability = await verifyMonthlyReportArtifact(artifact, kind);
  if (availability.status !== "available") return { artifact, availability, data: null as Buffer | null };
  const { data } = await storageGetBytes(file.key);
  // Recheck immediately before serving; a redirect alone cannot guarantee integrity.
  if (data.byteLength !== file.bytes || digest(data) !== file.sha256) {
    return { artifact, availability: { ...availability, status: "corrupt" as const }, data: null as Buffer | null };
  }
  return { artifact, availability, data };
}

export async function listMonthlyReportArtifacts(ownerOpenId = defaultArtifactScope(), filter?: MonthlyReportArtifactListFilter, evaluationNow = new Date()) {
  if (!isAuthorizedOwnerScope(ownerOpenId)) return [];
  if (filter?.year !== undefined && (!Number.isInteger(filter.year) || filter.year < 2000 || filter.year > 2200)) throw new Error("Invalid report year");
  if (filter?.month !== undefined && (!Number.isInteger(filter.month) || filter.month < 1 || filter.month > 12)) throw new Error("Invalid report month");
  const hasExplicitRange = Boolean(filter?.startDate || filter?.endDate);
  if (filter?.datePreset && hasExplicitRange) throw new Error("Gunakan preset atau rentang Jakarta/WIB, bukan keduanya.");
  if (hasExplicitRange && (!filter?.startDate || !filter?.endDate)) throw new Error("Rentang Jakarta/WIB harus lengkap.");
  const range = filter?.datePreset || hasExplicitRange
    ? resolveGovernanceAuditDateRange({
      ...(filter?.datePreset ? { datePreset: filter.datePreset } : {}),
      ...(filter?.startDate ? { startDate: filter.startDate } : {}),
      ...(filter?.endDate ? { endDate: filter.endDate } : {}),
    })
    : null;
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const rows = await db.select().from(monthlyReportArtifacts).where(and(isNull(monthlyReportArtifacts.retiredAt), isNull(monthlyReportArtifacts.archivedAt)));
  const matching = rows
    .map(mapArtifact)
    .filter((artifact) => !artifact.retiredAt && !artifact.archivedAt && artifact.lifecycleStatus !== "archived" && belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact) && (filter?.year === undefined || artifact.year === filter.year) && (filter?.month === undefined || artifact.month === filter.month) && (!range || isArtifactInResolvedRange(artifact, range)))
    .sort((left, right) => right.year - left.year || right.month - left.month);
  const verified = await Promise.all(matching.map(async (artifact) => ({
    id: artifact.id,
    year: artifact.year,
    month: artifact.month,
    timezone: artifact.timezone,
    periodStartDate: artifact.periodStartDate,
    periodEndDate: artifact.periodEndDate,
    generatedAt: artifact.generatedAt,
    lifecycleStatus: artifact.lifecycleStatus,
    archiveEligibleAt: artifact.archiveEligibleAt,
    csv: await verifyMonthlyReportArtifact(artifact, "csv"),
    printableHtml: await verifyMonthlyReportArtifact(artifact, "html"),
    pdf: await verifyMonthlyReportArtifact(artifact, "pdf"),
    retention: classifyMonthlyReportArtifactRetention(artifact, evaluationNow),
  })));
  return verified.filter((artifact) => {
    const files = [artifact.csv, artifact.printableHtml, artifact.pdf];
    if (filter?.integrity === "healthy" && !files.every((file) => file.status === "available")) return false;
    if (filter?.format === "csv" && artifact.csv.status !== "available") return false;
    if (filter?.format === "html" && artifact.printableHtml.status !== "available") return false;
    if (filter?.format === "pdf" && artifact.pdf.status !== "available") return false;
    if (filter?.retentionStatus && artifact.retention.status !== filter.retentionStatus) return false;
    return true;
  });
}

/**
 * Read-only report-period aggregate. Existing per-file verification remains the sole
 * authority: a report bundle is counted active only when all retrievable formats verify.
 */
export async function getMonthlyReportActiveArtifactSummary(ownerOpenId = defaultArtifactScope(), input: MonthlyReportActiveArtifactSummaryInput, referenceNow = new Date()): Promise<MonthlyReportActiveArtifactSummary> {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Akses artefak laporan dibatasi untuk pemilik StoreOS.");
  if (!isRangeInputComplete(input)) throw new Error("Ringkasan artefak memerlukan preset review atau rentang Jakarta/WIB lengkap.");
  const range = resolveGovernanceAuditDateRange(input, referenceNow);
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const rows = await db.select().from(monthlyReportArtifacts).where(and(isNull(monthlyReportArtifacts.retiredAt), isNull(monthlyReportArtifacts.archivedAt)));
  const candidates = rows
    .map(mapArtifact)
    .filter((artifact) => !artifact.retiredAt && !artifact.archivedAt && artifact.lifecycleStatus !== "archived" && belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact) && isArtifactInResolvedRange(artifact, range))
    .sort((left, right) => left.generatedAt.getTime() - right.generatedAt.getTime() || left.year - right.year || left.month - right.month);
  const availabilityCounts: Record<ArtifactIntegrityStatus, number> = { available: 0, missing: 0, corrupt: 0, retired: 0, archived: 0 };
  const verified: StoredMonthlyReportArtifact[] = [];
  for (const artifact of candidates) {
    const availability = await Promise.all(["csv", "html", "pdf"].map((kind) => verifyMonthlyReportArtifact(artifact, kind as ArtifactKind)));
    availability.forEach((entry) => { availabilityCounts[entry.status] += 1; });
    if (availability.every((entry) => entry.status === "available")) verified.push(artifact);
  }
  const oldest = verified[0] ?? null;
  const newest = verified.at(-1) ?? null;
  const classified = verified.map((artifact) => ({ artifact, retention: classifyMonthlyReportArtifactRetention(artifact, referenceNow) }));
  const approaching = classified.filter(({ retention }) => retention.status === "approaching");
  const eligible = classified.filter(({ retention }) => retention.status === "eligible");
  const oldestApproaching = approaching[0] ?? null;
  return {
    timezone: "Asia/Jakarta",
    range,
    calendarPeriodCount: countCalendarMonths(range),
    activeArtifactCount: verified.length * 3,
    artifactTypeCounts: { csv: verified.length, html: verified.length, pdf: verified.length },
    oldestActiveArtifact: oldest ? { year: oldest.year, month: oldest.month, generatedAt: oldest.generatedAt } : null,
    newestActiveArtifact: newest ? { year: newest.year, month: newest.month, generatedAt: newest.generatedAt } : null,
    integrity: { verifiedBundleCount: verified.length, excludedBundleCount: candidates.length - verified.length, availabilityCounts },
    retention: {
      retentionMonths: DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS,
      archiveWarningWindowDays: ARCHIVE_WARNING_WINDOW_DAYS,
      evaluatedAt: referenceNow,
      normalArtifactCount: classified.filter(({ retention }) => retention.status === "normal").length * 3,
      approachingArtifactCount: approaching.length * 3,
      eligibleArtifactCount: eligible.length * 3,
      approachingArtifactTypeCounts: { csv: approaching.length, html: approaching.length, pdf: approaching.length },
      oldestApproachingArtifact: oldestApproaching ? {
        year: oldestApproaching.artifact.year,
        month: oldestApproaching.artifact.month,
        generatedAt: oldestApproaching.artifact.generatedAt,
        archiveEligibleAt: oldestApproaching.retention.archiveEligibleAt,
      } : null,
    },
  };
}

const lifecycleOrder: Record<ArtifactLifecycleStatus, number> = { generated: 0, verified: 1, retained: 2, eligible_for_archive: 3, archived: 4 };

export async function getMonthlyReportArtifactLifecycleHistory(year: number, month: number, ownerOpenId = defaultArtifactScope()): Promise<MonthlyReportArtifactLifecycleHistory | null> {
  validatePeriod(year, month);
  if (!isAuthorizedOwnerScope(ownerOpenId)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const artifactRow = (await db.select().from(monthlyReportArtifacts).where(and(eq(monthlyReportArtifacts.year, year), eq(monthlyReportArtifacts.month, month))).limit(5))
    .find((row) => row.ownerOpenId === ownerOpenId || row.ownerOpenId === LEGACY_ARTIFACT_SCOPE);
  if (!artifactRow) return null;
  const artifact = mapArtifact(artifactRow);
  const events = await db.select().from(monthlyReportArtifactLifecycleEvents)
    .where(and(eq(monthlyReportArtifactLifecycleEvents.artifactId, artifact.id), eq(monthlyReportArtifactLifecycleEvents.ownerOpenId, artifact.ownerOpenId)));
  const chronological = events.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() || lifecycleOrder[left.lifecycleStatus as ArtifactLifecycleStatus] - lifecycleOrder[right.lifecycleStatus as ArtifactLifecycleStatus] || left.id - right.id);
  return {
    artifact: {
      id: artifact.id,
      year: artifact.year,
      month: artifact.month,
      timezone: artifact.timezone,
      generatedAt: artifact.generatedAt,
      lifecycleStatus: artifact.lifecycleStatus,
      archivedAt: artifact.archivedAt,
      retiredAt: artifact.retiredAt,
    },
    events: chronological.map((event) => ({
      reportPeriod: { year: artifact.year, month: artifact.month, timezone: artifact.timezone },
      lifecycleStatus: event.lifecycleStatus as ArtifactLifecycleStatus,
      occurredAt: event.occurredAt,
      reason: event.reason,
      actor: event.actor,
      source: event.source,
      artifactFormat: event.artifactFormat,
      integrity: parseIntegritySnapshot(event.integritySnapshot, artifact),
    })),
  };
}

function validateGovernanceAuditExportFilters(filters: GovernanceAuditExportFilters) {
  if (filters.year !== undefined && (!Number.isInteger(filters.year) || filters.year < 2000 || filters.year > 2200)) throw new Error("Invalid report year");
  if (filters.month !== undefined && (!Number.isInteger(filters.month) || filters.month < 1 || filters.month > 12)) throw new Error("Invalid report month");
  if (filters.lifecycleStatus !== undefined && !(filters.lifecycleStatus in lifecycleOrder)) throw new Error("Invalid artifact lifecycle status");
  if (filters.artifactFormat !== undefined && !(["csv", "html", "pdf"] as const).includes(filters.artifactFormat)) throw new Error("Invalid artifact format");
  if (filters.artifactScope !== undefined && filters.artifactScope !== "active" && filters.artifactScope !== "archived_or_retired") throw new Error("Invalid artifact audit scope");
}

function auditArtifactScope(artifact: StoredMonthlyReportArtifact): "active" | "archived" | "retired" {
  if (artifact.archivedAt || artifact.lifecycleStatus === "archived") return "archived";
  if (artifact.retiredAt) return "retired";
  return "active";
}

/**
 * Owner-scoped, read-only lifecycle audit dataset. It exports only immutable
 * event values and their recorded integrity snapshots; it never probes storage,
 * derives a replacement checksum, or records a new lifecycle event.
 */
export async function getMonthlyReportArtifactGovernanceAuditExport(
  ownerOpenId = defaultArtifactScope(),
  filters: GovernanceAuditExportFilters = {},
  generatedAt = new Date(),
): Promise<GovernanceAuditExport> {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Artifact governance scope is not authorized");
  validateGovernanceAuditExportFilters(filters);
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");

  const artifacts = (await db.select().from(monthlyReportArtifacts)).map(mapArtifact)
    .filter((artifact) => belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact))
    .filter((artifact) => filters.year === undefined || artifact.year === filters.year)
    .filter((artifact) => filters.month === undefined || artifact.month === filters.month)
    .filter((artifact) => {
      const scope = auditArtifactScope(artifact);
      return filters.artifactScope === undefined
        || (filters.artifactScope === "active" && scope === "active")
        || (filters.artifactScope === "archived_or_retired" && scope !== "active");
    });
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const events = await db.select().from(monthlyReportArtifactLifecycleEvents);
  const records: GovernanceAuditExportRecord[] = [];

  for (const event of events) {
    const artifact = artifactById.get(event.artifactId);
    if (!artifact || event.ownerOpenId !== artifact.ownerOpenId) continue;
    const lifecycleStatus = event.lifecycleStatus as ArtifactLifecycleStatus;
    if (filters.lifecycleStatus !== undefined && lifecycleStatus !== filters.lifecycleStatus) continue;
    const snapshot = parseStoredIntegritySnapshot(event.integritySnapshot);
    const scope = auditArtifactScope(artifact);
    const base = {
      reportPeriod: { year: artifact.year, month: artifact.month, timezone: artifact.timezone },
      lifecycleStatus,
      occurredAt: event.occurredAt,
      source: event.source,
      actor: event.actor,
      transitionReason: event.reason,
      eventArtifactFormat: event.artifactFormat,
      integritySnapshotStatus: snapshot.length ? "recorded" as const : "unavailable" as const,
      artifactScope: scope,
      currentLifecycleStatus: artifact.lifecycleStatus,
      archiveEligibleAt: artifact.archiveEligibleAt,
      archivedAt: artifact.archivedAt,
      retiredAt: artifact.retiredAt,
      archiveReason: artifact.archiveReason,
    };
    if (snapshot.length) {
      for (const item of snapshot) {
        if (filters.artifactFormat !== undefined && filters.artifactFormat !== item.kind) continue;
        records.push({ ...base, artifactFormat: item.kind, bytes: item.bytes, sha256: item.sha256 });
      }
    } else if (filters.artifactFormat === undefined) {
      records.push({ ...base, artifactFormat: "bundle", bytes: null, sha256: null });
    }
  }

  records.sort((left, right) => (
    right.reportPeriod.year - left.reportPeriod.year
    || right.reportPeriod.month - left.reportPeriod.month
    || right.occurredAt.getTime() - left.occurredAt.getTime()
    || lifecycleOrder[right.lifecycleStatus] - lifecycleOrder[left.lifecycleStatus]
    || left.source.localeCompare(right.source)
    || left.actor.localeCompare(right.actor)
    || (left.transitionReason ?? "").localeCompare(right.transitionReason ?? "")
    || left.artifactFormat.localeCompare(right.artifactFormat)
  ));

  return {
    kind: "storeos_governance_lifecycle_audit",
    version: 1,
    generatedAt,
    timezone: "Asia/Jakarta",
    filters: {
      year: filters.year ?? null,
      month: filters.month ?? null,
      lifecycleStatus: filters.lifecycleStatus ?? null,
      artifactFormat: filters.artifactFormat ?? null,
      artifactScope: filters.artifactScope ?? null,
    },
    recordCount: records.length,
    records,
  };
}

/** Compatibility query retained for existing callers; history remains append-only. */
export async function getMonthlyReportArtifactLifecycleEvents(year: number, month: number, ownerOpenId = defaultArtifactScope()): Promise<ArtifactLifecycleEvent[]> {
  return (await getMonthlyReportArtifactLifecycleHistory(year, month, ownerOpenId))?.events ?? [];
}

function emptyLifecycleCounts(): Record<ArtifactLifecycleStatus, number> {
  return { generated: 0, verified: 0, retained: 0, eligible_for_archive: 0, archived: 0 };
}

function emptyIntegrityCounts(): Record<ArtifactIntegrityStatus, number> {
  return { available: 0, missing: 0, corrupt: 0, retired: 0, archived: 0 };
}

export async function getMonthlyReportArtifactGovernanceSummary(
  ownerOpenId = defaultArtifactScope(),
  now = new Date(),
  retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS,
): Promise<MonthlyReportArtifactGovernanceSummary> {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Artifact governance scope is not authorized");
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const archiveCutoff = retentionCutoff(now, retentionMonths);
  const warningCutoff = new Date(archiveCutoff);
  warningCutoff.setUTCDate(warningCutoff.getUTCDate() + ARCHIVE_WARNING_WINDOW_DAYS);
  const allArtifacts = (await db.select().from(monthlyReportArtifacts)).map(mapArtifact)
    .filter((artifact) => belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact));
  const activeArtifacts = allArtifacts.filter((artifact) => !artifact.retiredAt && !artifact.archivedAt);
  const lifecycleCounts = emptyLifecycleCounts();
  const integrityCounts = emptyIntegrityCounts();
  const artifactTypeCounts: Record<ArtifactKind, number> = { csv: 0, html: 0, pdf: 0 };
  for (const artifact of allArtifacts) lifecycleCounts[artifact.lifecycleStatus] += 1;
  for (const artifact of activeArtifacts) {
    for (const kind of ["csv", "html", "pdf"] as const) {
      artifactTypeCounts[kind] += 1;
      integrityCounts[(await verifyMonthlyReportArtifact(artifact, kind)).status] += 1;
    }
  }
  const ordered = [...activeArtifacts].sort((left, right) => left.generatedAt.getTime() - right.generatedAt.getTime());
  return {
    retentionMonths,
    archiveWarningWindowDays: ARCHIVE_WARNING_WINDOW_DAYS,
    retainedArtifactCount: activeArtifacts.length,
    artifactTypeCounts,
    oldestRetainedReport: ordered[0] ? { year: ordered[0].year, month: ordered[0].month, generatedAt: ordered[0].generatedAt } : null,
    approachingArchive: ordered
      .filter((artifact) => artifact.generatedAt < warningCutoff || artifact.lifecycleStatus === "eligible_for_archive")
      .map((artifact) => ({
        year: artifact.year,
        month: artifact.month,
        generatedAt: artifact.generatedAt,
        lifecycleStatus: artifact.lifecycleStatus,
        daysUntilArchive: Math.max(0, Math.ceil((archiveCutoff.getTime() - artifact.generatedAt.getTime()) / 86_400_000)),
      })),
    lifecycleCounts,
    integrityCounts,
  };
}

export async function markMonthlyReportArtifactsEligibleForArchive(
  now = new Date(),
  retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS,
  ownerOpenId = defaultArtifactScope(),
) {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Artifact governance scope is not authorized");
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const cutoff = retentionCutoff(now, retentionMonths);
  const candidates = (await db.select().from(monthlyReportArtifacts).where(and(isNull(monthlyReportArtifacts.retiredAt), isNull(monthlyReportArtifacts.archivedAt), lt(monthlyReportArtifacts.generatedAt, cutoff))))
    .map(mapArtifact)
    .filter((artifact) => belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact) && artifact.lifecycleStatus === "retained");
  let affectedRows = 0;
  for (const artifact of candidates) {
    const result = await db.update(monthlyReportArtifacts).set({ lifecycleStatus: "eligible_for_archive", archiveEligibleAt: now })
      .where(and(eq(monthlyReportArtifacts.id, artifact.id), eq(monthlyReportArtifacts.lifecycleStatus, "retained")));
    const header = Array.isArray(result) ? result[0] : result;
    const applied = typeof (header as { affectedRows?: unknown } | undefined)?.affectedRows === "number" ? (header as { affectedRows: number }).affectedRows > 0 : true;
    if (applied) {
      affectedRows += 1;
      await recordLifecycleEvent(db, artifact, "eligible_for_archive", now, { reason: "retention_window_elapsed", actor: "retention-governance", source: "retention_policy" });
    }
  }
  return { cutoff, eligibleAt: now, ownerOpenId, affectedRows };
}

export async function archiveEligibleMonthlyReportArtifacts(now = new Date(), ownerOpenId = defaultArtifactScope()) {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Artifact governance scope is not authorized");
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const candidates = (await db.select().from(monthlyReportArtifacts).where(and(isNull(monthlyReportArtifacts.retiredAt), isNull(monthlyReportArtifacts.archivedAt), eq(monthlyReportArtifacts.lifecycleStatus, "eligible_for_archive"))))
    .map(mapArtifact)
    .filter((artifact) => artifact.lifecycleStatus === "eligible_for_archive" && belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact));
  let affectedRows = 0;
  for (const artifact of candidates) {
    const result = await db.update(monthlyReportArtifacts).set({ lifecycleStatus: "archived", archivedAt: now, archiveReason: "retention_window_elapsed", retiredAt: now })
      .where(and(eq(monthlyReportArtifacts.id, artifact.id), eq(monthlyReportArtifacts.lifecycleStatus, "eligible_for_archive"), isNull(monthlyReportArtifacts.retiredAt)));
    const header = Array.isArray(result) ? result[0] : result;
    const applied = typeof (header as { affectedRows?: unknown } | undefined)?.affectedRows === "number" ? (header as { affectedRows: number }).affectedRows > 0 : true;
    if (applied) {
      affectedRows += 1;
      await recordLifecycleEvent(db, artifact, "archived", now, { reason: "binary_access_revoked_audit_metadata_preserved", actor: "retention-governance", source: "retention_policy" });
    }
  }
  return { archivedAt: now, ownerOpenId, affectedRows };
}

/**
 * Executes the explicit owner-approved archive transition for exactly one
 * eligible report bundle. Artifact bytes are verified before a single
 * conditional metadata update blocks every active download. No bytes, report
 * source data, or prior lifecycle events are changed.
 */
export async function archiveMonthlyReportArtifactWithOwnerApproval(
  year: number,
  month: number,
  ownerOpenId: string,
  actorOpenId: string,
  now = new Date(),
): Promise<OwnerApprovedArchiveResult> {
  validatePeriod(year, month);
  if (!isAuthorizedOwnerScope(ownerOpenId) || ownerOpenId !== actorOpenId) {
    throw new Error("Artifact archive scope is not authorized");
  }
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");

  const row = (await db.select().from(monthlyReportArtifacts)
    .where(and(eq(monthlyReportArtifacts.year, year), eq(monthlyReportArtifacts.month, month)))
    .limit(5))
    .find((candidate) => candidate.ownerOpenId === ownerOpenId || candidate.ownerOpenId === LEGACY_ARTIFACT_SCOPE);
  if (!row) return { outcome: "not_found", artifact: null, availability: [], archivedAt: null };

  const artifact = mapArtifact(row);
  const reference = { id: artifact.id, year: artifact.year, month: artifact.month, lifecycleStatus: artifact.lifecycleStatus };
  if (artifact.archivedAt || artifact.retiredAt || artifact.lifecycleStatus === "archived") {
    return { outcome: "already_archived", artifact: reference, availability: [], archivedAt: artifact.archivedAt ?? artifact.retiredAt ?? null };
  }
  if (artifact.lifecycleStatus !== "eligible_for_archive") {
    return { outcome: "not_eligible", artifact: reference, availability: [], archivedAt: null };
  }

  const availability = await Promise.all((['csv', 'html', 'pdf'] as const).map((kind) => verifyMonthlyReportArtifact(artifact, kind)));
  if (availability.some((item) => item.status !== "available")) {
    return { outcome: "integrity_failed", artifact: reference, availability, archivedAt: null };
  }

  // One lifecycle-guarded update makes concurrent approvals deterministic: at
  // most one request wins; followers resolve as already archived without
  // emitting duplicate audit events.
  const update = await db.update(monthlyReportArtifacts)
    .set({ lifecycleStatus: "archived", archivedAt: now, archiveReason: "owner_approved_archive", retiredAt: now })
    .where(and(
      eq(monthlyReportArtifacts.id, artifact.id),
      eq(monthlyReportArtifacts.lifecycleStatus, "eligible_for_archive"),
      isNull(monthlyReportArtifacts.archivedAt),
      isNull(monthlyReportArtifacts.retiredAt),
    ));
  const header = Array.isArray(update) ? update[0] : update;
  const affectedRows = typeof (header as { affectedRows?: unknown } | undefined)?.affectedRows === "number"
    ? (header as { affectedRows: number }).affectedRows
    : 1;
  if (affectedRows < 1) {
    const latest = (await db.select().from(monthlyReportArtifacts).where(eq(monthlyReportArtifacts.id, artifact.id)).limit(1))[0];
    if (latest?.archivedAt || latest?.retiredAt || latest?.lifecycleStatus === "archived") {
      return { outcome: "already_archived", artifact: reference, availability: [], archivedAt: latest.archivedAt ?? latest.retiredAt ?? null };
    }
    return { outcome: "not_eligible", artifact: reference, availability: [], archivedAt: null };
  }

  await recordLifecycleEvent(db, artifact, "archived", now, {
    reason: "owner_approved_archive",
    actor: actorOpenId,
    source: "owner_archive_action",
    artifactFormat: "bundle",
  });
  return { outcome: "archived", artifact: { ...reference, lifecycleStatus: "archived" }, availability, archivedAt: now };
}

export async function archiveExpiredMonthlyReportArtifacts(
  now = new Date(),
  retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS,
  ownerOpenId = defaultArtifactScope(),
) {
  const eligible = await markMonthlyReportArtifactsEligibleForArchive(now, retentionMonths, ownerOpenId);
  const archived = await archiveEligibleMonthlyReportArtifacts(now, ownerOpenId);
  return { ...archived, cutoff: eligible.cutoff, eligibleRows: eligible.affectedRows };
}

/**
 * Compatibility name retained for Phase 2.3 callers. The behavior is now a
 * traceable two-step logical archive; no storage bytes or audit records are deleted.
 */
export async function retireExpiredMonthlyReportArtifacts(now = new Date(), retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS, ownerOpenId = defaultArtifactScope()) {
  const archived = await archiveExpiredMonthlyReportArtifacts(now, retentionMonths, ownerOpenId);
  return { cutoff: archived.cutoff, retiredAt: now, ownerOpenId, affectedRows: archived.affectedRows };
}
