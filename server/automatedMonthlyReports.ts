import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getMonthlyManagementReport, monthlyReportToCsv, resolveJakartaMonth } from "./monthlyReports";
import { persistMonthlyReportArtifacts } from "./monthlyReportArtifacts";
import { printableMonthlyHtmlToPdf } from "./monthlyReportPdf";

const JAKARTA_TIMEZONE = "Asia/Jakarta";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function resolvePreviousCompletedJakartaMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const index = year * 12 + month - 2;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

/**
 * Heartbeat accepts numeric day-of-month cron fields only. The UTC schedule
 * therefore wakes near the end of each UTC month; this guard ensures report
 * generation proceeds exclusively at 00:15 WIB on Jakarta's first day.
 */
export function isJakartaFirstCalendarDay(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    day: "2-digit",
  }).format(now);
  return day === "01";
}

export type AutomatedMonthlyReportArtifacts = {
  report: Awaited<ReturnType<typeof getMonthlyManagementReport>>;
  csv: string;
  printableHtml: string;
  pdf: Buffer;
  generatedAt: string;
};

export function monthlyReportToPrintableHtml(report: Awaited<ReturnType<typeof getMonthlyManagementReport>>) {
  const financialRows: Array<[string, string | number]> = [
    ["Gross Sales", report.financial.grossSales],
    ["Net Revenue", report.financial.netRevenue],
    ["COGS", report.financial.cogs],
    ["Gross Profit", report.financial.grossProfit],
    ["Gross Margin (%)", report.financial.grossMargin],
    ["Sales Transaction Count", report.financial.salesTransactionCount],
    ["Refund Value", report.financial.refundValue],
    ["Void Value", report.financial.voidValue],
    ["Exchange Impact", report.financial.exchangeImpact],
  ];
  const inventoryRows: Array<[string, string | number]> = [
    ["Opening Stock", report.inventory.openingStock],
    ["Closing Stock", report.inventory.closingStock],
    ["Expected Stock", report.inventory.expectedStock],
    ["Actual Stock", report.inventory.actualStock],
    ["Total Variance", report.inventory.totalVariance],
    ["Out-of-Tolerance Item Count", report.inventory.outOfToleranceItemCount],
    ["High-Value Variance Count", report.inventory.highValueVarianceCount],
    ["Recurring High Variance Ingredient Count", report.inventory.recurringHighVarianceIngredientCount],
    ["Stock-Opname Session Count", report.inventory.stockOpnameSessionCount],
    ["Open Stock-Opname Follow-Up Count", report.inventory.openStockOpnameFollowUpCount],
  ];
  const rows = (items: ReadonlyArray<readonly [string, string | number]>) => items.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const notes = report.auditNotes.length
    ? `<ul>${report.auditNotes.map((entry) => `<li><strong>${escapeHtml(entry.reference)}</strong> · ${escapeHtml(entry.type)}: ${escapeHtml(entry.note)}</li>`).join("")}</ul>`
    : "<p>Tidak ada catatan audit pada periode ini.</p>";
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(report.period.label)} — StoreOS Monthly Management Report</title><style>body{font-family:Arial,sans-serif;color:#183b2e;max-width:900px;margin:32px auto;padding:0 24px}h1{margin-bottom:4px}h2{margin-top:28px}small{color:#60766c}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #d7e2dd;padding:8px;text-align:left}th{width:65%;background:#f1f7f4}ul{line-height:1.5;padding-left:22px}@media print{body{margin:0;max-width:none}}</style></head><body><h1>StoreOS Monthly Management Report</h1><p><strong>${escapeHtml(report.period.label)}</strong><br>${escapeHtml(report.period.startDate)} s/d ${escapeHtml(report.period.endDate)} · ${escapeHtml(report.period.timezone)}</p><p><small>Generated At: ${escapeHtml(report.generatedAt)}</small></p><h2>Financial</h2><table>${rows(financialRows)}</table><h2>Inventory</h2><table>${rows(inventoryRows)}</table><h2>Audit Notes</h2>${notes}</body></html>`;
}

export async function generateAutomatedMonthlyManagementReport(year: number, month: number): Promise<AutomatedMonthlyReportArtifacts> {
  const report = await getMonthlyManagementReport({ year, month });
  const printableHtml = monthlyReportToPrintableHtml(report);
  return {
    report,
    csv: monthlyReportToCsv(report),
    printableHtml,
    pdf: printableMonthlyHtmlToPdf(printableHtml),
    generatedAt: report.generatedAt,
  };
}

/**
 * Project-level Heartbeat callback. It generates the previous completed
 * Jakarta calendar month and returns both report artifacts without mutating
 * transactional, inventory, or audit data. Server-side PDF rendering remains
 * intentionally out of scope; CSV and printable HTML are durably stored.
 */
export async function handleAutomatedMonthlyReport(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const now = new Date();
    if (!isJakartaFirstCalendarDay(now)) {
      return res.json({
        ok: true,
        skipped: true,
        reason: "outside_jakarta_month_boundary",
      });
    }
    const target = resolvePreviousCompletedJakartaMonth(now);
    const artifacts = await generateAutomatedMonthlyManagementReport(target.year, target.month);
    const persisted = await persistMonthlyReportArtifacts(artifacts);
    return res.json({
      ok: true,
      period: artifacts.report.period,
      generatedAt: artifacts.generatedAt,
      artifact: persisted.artifact,
      created: persisted.created,
      delivery: { csv: "stored", printableHtml: "stored", pdf: "stored" },
    });
  } catch (error) {
    return res.status(500).json({
      error: String(error instanceof Error ? error.message : error),
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl },
    });
  }
}

export function getMonthlyHeartbeatDefinition() {
  return {
    name: "storeos-monthly-management-report",
    cron: "0 15 17 28-31 * *",
    path: "/api/scheduled/monthly-management-report",
    description: "Wake at 00:15 WIB across the final Jakarta calendar days; generate only when the Jakarta-first-day guard confirms the previous completed month boundary.",
  } as const;
}

export { resolveJakartaMonth };
