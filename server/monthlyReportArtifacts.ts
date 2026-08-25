import { createHash } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { monthlyReportArtifacts } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetBytes, storagePut } from "./storage";
import { ENV } from "./_core/env";
import type { AutomatedMonthlyReportArtifacts } from "./automatedMonthlyReports";

export type MonthlyReport = AutomatedMonthlyReportArtifacts;
export const LEGACY_ARTIFACT_SCOPE = "legacy-single-store";
export const DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS = 24;
export type ArtifactKind = "csv" | "html" | "pdf";
export type ArtifactIntegrityStatus = "available" | "missing" | "corrupt" | "retired";

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
  retiredAt: Date | null;
  createdAt: Date;
};

export type ArtifactAvailability = {
  kind: ArtifactKind;
  bytes: number;
  sha256: string;
  status: ArtifactIntegrityStatus;
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
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
  };
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
  )).limit(5)).find((candidate) => candidate.ownerOpenId === ownerOpenId || candidate.ownerOpenId === LEGACY_ARTIFACT_SCOPE);
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
    const result = await db.insert(monthlyReportArtifacts).values({
      ownerOpenId: defaultArtifactScope(),
      year: report.report.period.year,
      month: report.report.period.month,
      timezone: report.report.period.timezone,
      periodStartDate: report.report.period.startDate,
      periodEndDate: report.report.period.endDate,
      generatedAt: new Date(report.generatedAt),
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
    });
    const id = Number(result[0].insertId);
    const inserted = (await db.select().from(monthlyReportArtifacts).where(eq(monthlyReportArtifacts.id, id)).limit(1))[0];
    if (!inserted) throw new Error("Monthly report artifact record was not created");
    return { created: true as const, artifact: mapArtifact(inserted) };
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
  const rows = await db.select().from(monthlyReportArtifacts).where(isNull(monthlyReportArtifacts.retiredAt));
  const matching = rows
    .filter((row) => (row.ownerOpenId === ownerOpenId || row.ownerOpenId === LEGACY_ARTIFACT_SCOPE) && (filter?.year === undefined || row.year === filter.year) && (filter?.month === undefined || row.month === filter.month))
    .sort((left, right) => right.year - left.year || right.month - left.month)
    .map(mapArtifact);
  return Promise.all(matching.map(async (artifact) => ({
    id: artifact.id,
    year: artifact.year,
    month: artifact.month,
    timezone: artifact.timezone,
    periodStartDate: artifact.periodStartDate,
    periodEndDate: artifact.periodEndDate,
    generatedAt: artifact.generatedAt,
    csv: await verifyMonthlyReportArtifact(artifact, "csv"),
    printableHtml: await verifyMonthlyReportArtifact(artifact, "html"),
    pdf: await verifyMonthlyReportArtifact(artifact, "pdf"),
  })));
}

/**
 * The platform storage helper intentionally has no object-delete endpoint.
 * Retention is therefore a safe logical purge: an expired record is marked as
 * retired, retained for audit metadata, and permanently excluded from every
 * application lookup. The operation touches only the report-artifact table and
 * can run repeatedly without changing a prior retirement.
 */
export async function retireExpiredMonthlyReportArtifacts(now = new Date(), retentionMonths = DEFAULT_MONTHLY_REPORT_RETENTION_MONTHS, ownerOpenId = defaultArtifactScope()) {
  if (!isAuthorizedOwnerScope(ownerOpenId)) throw new Error("Artifact retention scope is not authorized");
  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  const cutoff = retentionCutoff(now, retentionMonths);
  const result = await db.update(monthlyReportArtifacts)
    .set({ retiredAt: now })
    .where(and(eq(monthlyReportArtifacts.ownerOpenId, ownerOpenId), isNull(monthlyReportArtifacts.retiredAt), lt(monthlyReportArtifacts.generatedAt, cutoff)));
  return { cutoff, retiredAt: now, ownerOpenId, affectedRows: Number((result as { affectedRows?: number })?.affectedRows ?? 0) };
}
