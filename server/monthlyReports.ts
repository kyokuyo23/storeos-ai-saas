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
  const totalVariance = round(currentInventory.rows.reduce((sum, row) => sum + row.variance, 0), 3);
  const openingStock = round(currentInventory.rows.reduce((sum, row) => sum + row.openingStock, 0), 3);
  const closingStock = round(currentInventory.rows.reduce((sum, row) => sum + row.actualClosingStock, 0), 3);
  const expectedStock = round(currentInventory.rows.reduce((sum, row) => sum + row.expectedClosingStock, 0), 3);
  return {
    period: { year: period.year, month: period.month, startDate: period.startDate, endDate: period.endDate, label: period.label, timezone: "Asia/Jakarta" },
    financial: {
      grossSales: financial.revenue,
      netRevenue: financial.revenue,
      cogs: financial.cogs,
      grossProfit: financial.grossProfit,
      grossMargin: financial.grossMargin,
      salesTransactionCount: financial.saleCount,
      refundValue: 0,
      voidValue: 0,
      exchangeImpact: 0,
    },
    inventory: {
      openingStock,
      closingStock,
      expectedStock,
      actualStock: closingStock,
      totalVariance,
      outOfToleranceItemCount: currentInventory.rows.filter((row) => !row.withinTolerance).length,
      highValueVarianceCount: highValueCount,
      recurringHighVarianceIngredientCount: recurringCount,
      stockOpnameSessionCount: monthSessions.length,
      openStockOpnameFollowUpCount: openFollowUpCount,
    },
    source: { financial: "Financial Core", inventory: "Inventory Ledger + Inventory Intelligence", recurringVariancePeriods: inventoryPeriods.map(({ period: item }) => item.startDate) },
  };
}

export function monthlyReportToCsv(report: Awaited<ReturnType<typeof getMonthlyManagementReport>>) {
  const rows = [
    ["StoreOS Monthly Management Report", report.period.label],
    ["Periode mulai", report.period.startDate],
    ["Periode akhir", report.period.endDate],
    ["Timezone", report.period.timezone],
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
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}
