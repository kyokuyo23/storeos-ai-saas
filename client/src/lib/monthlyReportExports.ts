export type MonthlyReportExportData = {
  generatedAt?: string;
  auditNotes?: Array<{ reference: string; type: "session" | "follow_up"; note: string }>;
  period: {
    label: string;
    startDate: string;
    endDate: string;
    timezone: string;
    year: number;
    month: number;
  };
  financial: {
    grossSales: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    salesTransactionCount: number;
    refundValue: number;
    voidValue: number;
    exchangeImpact: number;
  };
  inventory: {
    openingStockValue: number;
    closingStockValue: number;
    expectedClosingStockValue: number;
    actualClosingStockValue: number;
    totalVarianceValue: number;
    outOfToleranceItemCount: number;
    highValueVarianceCount: number;
    recurringHighVarianceIngredientCount: number;
    stockOpnameSessionCount: number;
    openStockOpnameFollowUpCount: number;
  };
};

const rowsFor = (report: MonthlyReportExportData): Array<Array<string | number>> => [
  ["StoreOS Monthly Management Report", report.period.label],
  ["Periode mulai", report.period.startDate],
  ["Periode akhir", report.period.endDate],
  ["Timezone", report.period.timezone],
  ["Generated At", report.generatedAt ?? ""],
  [],
  ["Financial", "Nilai"],
  ["Gross Sales", report.financial.grossSales],
  ["Net Revenue", report.financial.netRevenue],
  ["COGS", report.financial.cogs],
  ["Gross Profit", report.financial.grossProfit],
  ["Gross Margin (%)", report.financial.grossMargin],
  ["Sales Transaction Count", report.financial.salesTransactionCount],
  ["Refund Value", report.financial.refundValue],
  ["Void Value", report.financial.voidValue],
  ["Exchange Impact", report.financial.exchangeImpact],
  [],
  ["Inventory", "Nilai"],
  ["Opening Stock Value (Rp)", report.inventory.openingStockValue],
  ["Closing Stock Value (Rp)", report.inventory.closingStockValue],
  ["Expected Closing Stock Value (Rp)", report.inventory.expectedClosingStockValue],
  ["Actual Closing Stock Value (Rp)", report.inventory.actualClosingStockValue],
  ["Total Variance Value (Rp)", report.inventory.totalVarianceValue],
  ["Out-of-Tolerance Item Count", report.inventory.outOfToleranceItemCount],
  ["High-Value Variance Count", report.inventory.highValueVarianceCount],
  ["Recurring High Variance Ingredient Count", report.inventory.recurringHighVarianceIngredientCount],
  ["Stock-Opname Session Count", report.inventory.stockOpnameSessionCount],
  ["Open Stock-Opname Follow-Up Count", report.inventory.openStockOpnameFollowUpCount],
  [],
  ["Audit Notes", "Catatan"],
  ...(report.auditNotes ?? []).map((entry) => ["", `${entry.reference} · ${entry.type}: ${entry.note}`]),
];

const escapeCell = (cell: string | number | undefined | null) => `"${String(cell ?? "").replaceAll('"', '""')}"`;

export function buildMonthlyReportCsv(report: MonthlyReportExportData): string {
  const body = rowsFor(report).map((row) => row.map(escapeCell).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}

/** PRD FR-3 standard file name stem: StoreOS_Monthly_Report_YYYY-MM. */
export function monthlyReportFileStem(year: number, month: number): string {
  return `StoreOS_Monthly_Report_${year}-${String(month).padStart(2, "0")}`;
}

export function monthlyReportCsvFilename(report: MonthlyReportExportData): string {
  return `${monthlyReportFileStem(report.period.year, report.period.month)}.csv`;
}

export function downloadMonthlyReportCsv(report: MonthlyReportExportData): void {
  const url = URL.createObjectURL(new Blob([buildMonthlyReportCsv(report)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = monthlyReportCsvFilename(report);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printMonthlyReport(report: MonthlyReportExportData | undefined): void {
  if (!report) return;
  // Browsers use the document title as the default "Save as PDF" file name.
  if (typeof document !== "undefined" && typeof window.addEventListener === "function") {
    const previousTitle = document.title;
    document.title = monthlyReportFileStem(report.period.year, report.period.month);
    const restore = () => { document.title = previousTitle; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
  }
  window.print();
}
