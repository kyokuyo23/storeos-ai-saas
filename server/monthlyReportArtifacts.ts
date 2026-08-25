import { createHash } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { monthlyReportArtifactLifecycleEvents, monthlyReportArtifacts } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetBytes, storagePut } from "./storage";
import { ENV } from "./_core/env";
import type { AutomatedMonthlyReportArtifacts } from "./automatedMonthlyReports";

export type MonthlyReport = AutomatedMonthlyReportArtifacts;
export const LEGACY_ARTIFACT_SCOPE = "legacy-single-store";
export const DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS = 24;
export const ARCHIVE_WARNING_WINDOW_DAYS = 90;
export type ArtifactKind = "csv" | "html" | "pdf";
export type ArtifactLifecycleStatus = "generated" | "verified" | "retained" | "eligible_for_archive" | "archived";
export type ArtifactIntegrityStatus = "available" | "missing" | "corrupt" | "retired" | "archived";
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
  lifecycleStatus: ArtifactLifecycleStatus;
  occurredAt: Date;
  reason: string | null;
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

async function recordLifecycleEvent(
  db: MonthlyReportDb,
  artifact: Pick<StoredMonthlyReportArtifact, "id" | "ownerOpenId">,
  lifecycleStatus: ArtifactLifecycleStatus,
  occurredAt: Date,
  reason: string | null = null,
) {
  await db.insert(monthlyReportArtifactLifecycleEvents).values({
    artifactId: artifact.id,
    ownerOpenId: artifact.ownerOpenId,
    lifecycleStatus,
    occurredAt,
    reason,
  });
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
    await recordLifecycleEvent(db, artifact, "generated", generatedAt, "immutable_artifact_persisted");
    await recordLifecycleEvent(db, artifact, "verified", generatedAt, "sha256_metadata_recorded");
    await recordLifecycleEvent(db, artifact, "retained", generatedAt, "within_24_month_retention_window");
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

export async function listMonthlyReportArtifacts(ownerOpenId = defaultArtifactScope(), filter?: { year?: number; month?: number }) {
  if (!isAuthorizedOwnerScope(ownerOpenId)) return [];
  if (filter?.year !== undefined && (!Number.isInteger(filter.year) || filter.year < 2000 || filter.year > 2200)) throw new Error("Invalid report year");
  if (filter?.month !== undefined && (!Number.isInteger(filter.month) || filter.month < 1 || filter.month > 12)) throw new Error("Invalid report month");
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const rows = await db.select().from(monthlyReportArtifacts).where(and(isNull(monthlyReportArtifacts.retiredAt), isNull(monthlyReportArtifacts.archivedAt)));
  const matching = rows
    .map(mapArtifact)
    .filter((artifact) => !artifact.retiredAt && !artifact.archivedAt && artifact.lifecycleStatus !== "archived" && belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact) && (filter?.year === undefined || artifact.year === filter.year) && (filter?.month === undefined || artifact.month === filter.month))
    .sort((left, right) => right.year - left.year || right.month - left.month);
  return Promise.all(matching.map(async (artifact) => ({
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
  })));
}

export async function getMonthlyReportArtifactLifecycleEvents(year: number, month: number, ownerOpenId = defaultArtifactScope()): Promise<ArtifactLifecycleEvent[]> {
  validatePeriod(year, month);
  if (!isAuthorizedOwnerScope(ownerOpenId)) return [];
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const artifactRow = (await db.select().from(monthlyReportArtifacts).where(and(eq(monthlyReportArtifacts.year, year), eq(monthlyReportArtifacts.month, month))).limit(5))
    .find((row) => row.ownerOpenId === ownerOpenId || row.ownerOpenId === LEGACY_ARTIFACT_SCOPE);
  if (!artifactRow) return [];
  const artifact = mapArtifact(artifactRow);
  const events = await db.select().from(monthlyReportArtifactLifecycleEvents)
    .where(and(eq(monthlyReportArtifactLifecycleEvents.artifactId, artifact.id), eq(monthlyReportArtifactLifecycleEvents.ownerOpenId, artifact.ownerOpenId)));
  return events.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()).map((event) => ({
    lifecycleStatus: event.lifecycleStatus as ArtifactLifecycleStatus,
    occurredAt: event.occurredAt,
    reason: event.reason,
  }));
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
  for (const artifact of candidates) {
    await db.update(monthlyReportArtifacts).set({ lifecycleStatus: "eligible_for_archive", archiveEligibleAt: now })
      .where(and(eq(monthlyReportArtifacts.id, artifact.id), eq(monthlyReportArtifacts.lifecycleStatus, "retained")));
    await recordLifecycleEvent(db, artifact, "eligible_for_archive", now, "retention_window_elapsed");
  }
  return { cutoff, eligibleAt: now, ownerOpenId, affectedRows: candidates.length };
}

export async function archiveEligibleMonthlyReportArtifacts(now = new Date(), ownerOpenId = defaultArtifactScope()) {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Artifact governance scope is not authorized");
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const candidates = (await db.select().from(monthlyReportArtifacts).where(and(isNull(monthlyReportArtifacts.retiredAt), isNull(monthlyReportArtifacts.archivedAt), eq(monthlyReportArtifacts.lifecycleStatus, "eligible_for_archive"))))
    .map(mapArtifact)
    .filter((artifact) => artifact.lifecycleStatus === "eligible_for_archive" && belongsToOwnerScope(artifact, ownerOpenId) && isProductionArtifact(artifact));
  for (const artifact of candidates) {
    await db.update(monthlyReportArtifacts).set({ lifecycleStatus: "archived", archivedAt: now, archiveReason: "retention_window_elapsed", retiredAt: now })
      .where(and(eq(monthlyReportArtifacts.id, artifact.id), eq(monthlyReportArtifacts.lifecycleStatus, "eligible_for_archive"), isNull(monthlyReportArtifacts.retiredAt)));
    await recordLifecycleEvent(db, artifact, "archived", now, "binary_access_revoked_audit_metadata_preserved");
  }
  return { archivedAt: now, ownerOpenId, affectedRows: candidates.length };
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
