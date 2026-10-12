/**
 * Store insights: rule-based analysis of the last N days versus the previous N days.
 * Every number comes from recorded sales and stock movements; nothing is estimated by a model.
 */
import type { FinancialTotals, ProductPerformance } from "./financials";

export type InsightTone = "positive" | "negative" | "neutral";
export type InsightFinding = { id: string; tone: InsightTone; title: string; detail: string };
export type InsightIngredient = { id: number; name: string; unit: string; currentStock: number; isActive: boolean };
export type InsightProduct = { id: number; name: string; isActive: boolean };
export type StockCoverage = { ingredientId: number; name: string; unit: string; currentStock: number; usedInPeriod: number; avgDailyUse: number; coverageDays: number | null };

const LOW_MARGIN_PERCENT = 30;
const SHORT_COVERAGE_DAYS = 7;
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

/** Percentage change, or null when the previous period has no base to compare with. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return null;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

export function buildStoreInsights(input: {
  days: number;
  current: FinancialTotals & { productPerformance: ProductPerformance[] };
  previous: FinancialTotals & { productPerformance: ProductPerformance[] };
  products: InsightProduct[];
  ingredients: InsightIngredient[];
  /** Net recipe consumption per ingredient in the current period (positive = used). */
  consumption: Map<number, number>;
}) {
  const { current, previous, days } = input;
  const revenueChange = percentChange(current.revenue, previous.revenue);
  const marginChangePoints = previous.saleCount > 0 ? round(current.grossMargin - previous.grossMargin, 1) : null;
  const averageTicket = current.saleCount > 0 ? round(current.revenue / current.saleCount) : 0;

  const topProducts = [...current.productPerformance].filter((product) => product.quantity > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const lowMarginProducts = current.productPerformance.filter((product) => product.revenue > 0 && product.grossMargin < LOW_MARGIN_PERCENT).sort((a, b) => a.grossMargin - b.grossMargin);
  const soldIds = new Set(current.productPerformance.filter((product) => product.quantity > 0).map((product) => product.productId));
  const unsoldProducts = input.products.filter((product) => product.isActive && !soldIds.has(product.id)).map((product) => ({ productId: product.id, productName: product.name }));

  const stockCoverage: StockCoverage[] = input.ingredients.filter((ingredient) => ingredient.isActive).map((ingredient) => {
    const usedInPeriod = round(Math.max(0, input.consumption.get(ingredient.id) ?? 0), 3);
    const avgDailyUse = round(usedInPeriod / days, 3);
    const coverageDays = avgDailyUse > 0 ? round(Math.max(0, ingredient.currentStock) / avgDailyUse, 1) : null;
    return { ingredientId: ingredient.id, name: ingredient.name, unit: ingredient.unit, currentStock: ingredient.currentStock, usedInPeriod, avgDailyUse, coverageDays };
  }).sort((a, b) => (a.coverageDays ?? Number.POSITIVE_INFINITY) - (b.coverageDays ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name, "id"));

  const findings: InsightFinding[] = [];
  if (current.saleCount === 0) {
    findings.push({ id: "no-sales", tone: "neutral", title: `Belum ada penjualan dalam ${days} hari terakhir`, detail: "Insight penjualan dan margin akan muncul setelah transaksi tercatat di POS." });
  } else {
    if (revenueChange === null) findings.push({ id: "revenue-new", tone: "neutral", title: `Pendapatan ${rupiah(current.revenue)} dalam ${days} hari terakhir`, detail: `Belum ada penjualan pada ${days} hari sebelumnya untuk dibandingkan.` });
    else findings.push({ id: "revenue-trend", tone: revenueChange >= 0 ? "positive" : "negative", title: `Pendapatan ${revenueChange >= 0 ? "naik" : "turun"} ${Math.abs(revenueChange)}%`, detail: `${rupiah(current.revenue)} dibanding ${rupiah(previous.revenue)} pada ${days} hari sebelumnya.` });
    if (marginChangePoints !== null && Math.abs(marginChangePoints) >= 1) findings.push({ id: "margin-trend", tone: marginChangePoints >= 0 ? "positive" : "negative", title: `Margin kotor ${marginChangePoints >= 0 ? "membaik" : "memburuk"} ${Math.abs(marginChangePoints)} poin`, detail: `Margin sekarang ${current.grossMargin}% (sebelumnya ${previous.grossMargin}%).` });
    if (topProducts[0]) {
      const share = current.revenue > 0 ? round((topProducts[0].revenue / current.revenue) * 100, 1) : 0;
      findings.push({ id: "top-product", tone: "neutral", title: `Produk terlaris: ${topProducts[0].productName}`, detail: `${topProducts[0].quantity} terjual, ${rupiah(topProducts[0].revenue)} (${share}% pendapatan).` });
    }
    if (lowMarginProducts.length) findings.push({ id: "low-margin", tone: "negative", title: `${lowMarginProducts.length} produk bermargin di bawah ${LOW_MARGIN_PERCENT}%`, detail: `Terendah: ${lowMarginProducts[0].productName} (${lowMarginProducts[0].grossMargin}%). Tinjau harga jual atau resep.` });
    if (current.refundValue + current.voidValue > 0) findings.push({ id: "reversals", tone: "negative", title: "Ada pembatalan atau refund", detail: `Void ${rupiah(current.voidValue)}, refund ${rupiah(current.refundValue)} dalam ${days} hari terakhir.` });
  }
  if (unsoldProducts.length && current.saleCount > 0) findings.push({ id: "unsold", tone: "neutral", title: `${unsoldProducts.length} produk aktif tidak terjual`, detail: `Contoh: ${unsoldProducts.slice(0, 3).map((product) => product.productName).join(", ")}.` });
  const short = stockCoverage.filter((row) => row.coverageDays !== null && row.coverageDays < SHORT_COVERAGE_DAYS);
  if (short.length) findings.push({ id: "short-coverage", tone: "negative", title: `${short.length} bahan diperkirakan habis dalam < ${SHORT_COVERAGE_DAYS} hari`, detail: `${short[0].name}: cukup ±${short[0].coverageDays} hari dengan pemakaian rata-rata ${short[0].avgDailyUse} ${short[0].unit}/hari.` });

  return {
    days,
    kpis: { revenue: current.revenue, revenueChange, grossProfit: current.grossProfit, grossMargin: current.grossMargin, marginChangePoints, saleCount: current.saleCount, unitsSold: current.unitsSold, averageTicket },
    topProducts,
    lowMarginProducts,
    unsoldProducts,
    stockCoverage,
    findings,
    thresholds: { lowMarginPercent: LOW_MARGIN_PERCENT, shortCoverageDays: SHORT_COVERAGE_DAYS },
  };
}
