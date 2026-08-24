import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { monthlyReportArtifacts } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut, storageGet } from "./storage";
import type { AutomatedMonthlyReportArtifacts } from "./automatedMonthlyReports";

export type MonthlyReport = AutomatedMonthlyReportArtifacts;

export type StoredMonthlyReportArtifact = {
  id: number;
  year: number;
  month: number;
  timezone: string;
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: Date;
  csv: { key: string; url: string; sha256: string; bytes: number };
  printableHtml: { key: string; url: string; sha256: string; bytes: number };
  createdAt: Date;
};

function digest(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function validatePeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("Invalid report year");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Invalid report month");
}

function mapArtifact(row: typeof monthlyReportArtifacts.$inferSelect): StoredMonthlyReportArtifact {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    timezone: row.timezone,
    periodStartDate: row.periodStartDate,
    periodEndDate: row.periodEndDate,
    generatedAt: row.generatedAt,
    csv: { key: row.csvKey, url: row.csvUrl, sha256: row.csvSha256, bytes: row.csvBytes },
    printableHtml: { key: row.htmlKey, url: row.htmlUrl, sha256: row.htmlSha256, bytes: row.htmlBytes },
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

export async function persistMonthlyReportArtifacts(report: MonthlyReport) {
  validatePeriod(report.report.period.year, report.report.period.month);
  const existing = await getMonthlyReportArtifact(report.report.period.year, report.report.period.month);
  if (existing) return { created: false as const, artifact: existing };

  const csvBytes = Buffer.byteLength(report.csv, "utf8");
  const htmlBytes = Buffer.byteLength(report.printableHtml, "utf8");
  const csvSha256 = digest(report.csv);
  const htmlSha256 = digest(report.printableHtml);
  const prefix = `monthly-management-reports/${report.report.period.year}/${String(report.report.period.month).padStart(2, "0")}`;
  const [csvObject, htmlObject] = await Promise.all([
    storagePut(`${prefix}/report.csv`, report.csv, "text/csv; charset=utf-8"),
    storagePut(`${prefix}/report.html`, report.printableHtml, "text/html; charset=utf-8"),
  ]);

  const db = await getDb();
  if (!db) throw new Error("Database tidak tersedia. Silakan coba lagi.");
  try {
    const result = await db.insert(monthlyReportArtifacts).values({
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
    });
    const id = Number(result[0].insertId);
    const inserted = (await db.select().from(monthlyReportArtifacts).where(eq(monthlyReportArtifacts.id, id)).limit(1))[0];
    if (!inserted) throw new Error("Monthly report artifact record was not created");
    return { created: true as const, artifact: mapArtifact(inserted) };
  } catch (error) {
    // A concurrent invocation may have won the unique period race. Never overwrite it.
      const winner = await getMonthlyReportArtifact(report.report.period.year, report.report.period.month);
    if (winner) return { created: false as const, artifact: winner };
    throw error;
  }
}

export async function getMonthlyReportArtifactDownloadUrls(year: number, month: number) {
  const artifact = await getMonthlyReportArtifact(year, month);
  if (!artifact) return null;
  const [csv, printableHtml] = await Promise.all([storageGet(artifact.csv.key), storageGet(artifact.printableHtml.key)]);
  return { ...artifact, csv: { ...artifact.csv, url: csv.url }, printableHtml: { ...artifact.printableHtml, url: printableHtml.url } };
}
