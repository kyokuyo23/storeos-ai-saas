import { getFinancialDashboard, getInventoryIntelligence, listStockOpnameSessions } from "./db";
import { analyzeRepeatedVariances, type PeriodVarianceRecord } from "../client/src/lib/repeatedVariance";

const DAY_MS = 24 * 60 * 60 * 1000;
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export type MonthlyReportPeriod = {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  start: Date;
  end: Date;
  label: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function resolveJakartaMonth(year: number, month: number): MonthlyReportPeriod {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Tahun laporan tidak valid.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Bulan laporan tidak valid.");
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const startDate = `${year}-${pad(month)}-01`;
  const nextStartDate = `${nextYear}-${pad(nextMonth)}-01`;
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const end = new Date(`${nextStartDate}T00:00:00+07:00`);
  const endDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(end.getTime() - 1));
  return { year, month, startDate, endDate, start, end, label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(start) };
}

function previousMonth(year: number, month: number, offset: number) {
  const index = year * 12 + (month - 1) - offset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export async function getMonthlyManagementReport(input: { year: number; month: number }) {
  const period = resolveJakartaMonth(input.year, input.month);
  const financial = await getFinancialDashboard({ startDate: period.startDate, endDate: period.endDate });
  const inventoryPeriods = await Promise.all([0, 1, 2].map((offset) => {
    const target = previousMonth(period.year, period.month, offset);
    const targetPeriod = resolveJakartaMonth(target.year, target.month);
    return getInventoryIntelligence({ startDate: targetPeriod.startDate, endDate: targetPeriod.endDate }).then((report) => ({ period: targetPeriod, report }));
  }));
  const currentInventory = inventoryPeriods[0].report;
  const records: PeriodVarianceRecord[] = inventoryPeriods.flatMap(({ period: targetPeriod, report }) => report.rows.map((row) => ({
    periodKey: targetPeriod.startDate,
    label: targetPeriod.label,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    varianceQty: row.variance,
    varianceValue: row.varianceValue,
    isOut: !row.withinTolerance,
  })));
  const recurrence = analyzeRepeatedVariances(records);
  const recurringCount = Array.from(recurrence.values()).filter((item) => item.isRepeatedHighVariance).length;
  const sessions = await listStockOpnameSessions();
  const monthSessions = sessions.filter((session) => session.occurredAt >= period.start && session.occurredAt < period.end);
  const openFollowUpCount = monthSessions.filter((session) => session.followUpStatus === "needs_follow_up" || session.followUpStatus === "in_progress").length;
  const highValueCount = currentInventory.rows.filter((row) => row.varianceExcessValue > 0).length;
  // PRD: stock is reported as Rupiah value (quantity x ingredient cost per unit). Quantities in different
  // units (gram, ml, pcs) cannot be summed meaningfully, so every aggregate is a valuation.
  const valueOf = (pick: (row: (typeof currentInventory.rows)[number]) => number) => round(currentInventory.rows.reduce((sum, row) => sum + pick(row) * row.costPerUnit, 0));
  const openingStockValue = valueOf((row) => row.openingStock);
  const actualClosingStockValue = valueOf((row) => row.actualClosingStock);
  const expectedClosingStockValue = valueOf((row) => row.expectedClosingStock);
  const totalVarianceValue = round(currentInventory.rows.reduce((sum, row) => sum + row.varianceValue, 0));
  const auditNotes = monthSessions.flatMap((session) => [
    session.note ? { reference: session.reference, type: "session" as const, note: session.note } : null,
    session.followUpNote ? { reference: session.reference, type: "follow_up" as const, note: session.followUpNote } : null,
  ].filter((entry): entry is { reference: string; type: "session" | "follow_up"; note: string } => Boolean(entry)));
  return {
    period: { year: period.year, month: period.month, startDate: period.startDate, endDate: period.endDate, label: period.label, timezone: "Asia/Jakarta" },
    generatedAt: new Date().toISOString(),
    auditNotes,
    financial: {
      grossSales: financial.grossSales,
      netRevenue: financial.revenue,
      cogs: financial.cogs,
      grossProfit: financial.grossProfit,
      grossMargin: financial.grossMargin,
      salesTransactionCount: financial.saleCount,
      refundValue: financial.refundValue,
      voidValue: financial.voidValue,
      exchangeImpact: financial.exchangeImpact,
    },
    inventory: {
      openingStockValue,
      closingStockValue: actualClosingStockValue,
      expectedClosingStockValue,
      actualClosingStockValue,
      totalVarianceValue,
      outOfToleranceItemCount: currentInventory.rows.filter((row) => !row.withinTolerance).length,
      highValueVarianceCount: highValueCount,
      recurringHighVarianceIngredientCount: recurringCount,
      stockOpnameSessionCount: monthSessions.length,
      openStockOpnameFollowUpCount: openFollowUpCount,
    },
    source: { financial: "Financial Core", inventory: "Inventory Ledger + Inventory Intelligence", auditNotes: "Stock Opname + Follow-up", recurringVariancePeriods: inventoryPeriods.map(({ period: item }) => item.startDate) },
  };
}

export function monthlyReportToCsv(report: Awaited<ReturnType<typeof getMonthlyManagementReport>>) {
  const rows = [
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
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}
