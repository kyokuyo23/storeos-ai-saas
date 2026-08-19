export type FinancialIngredientSnapshot = { ingredientId?: number; unitQuantity: number; unitCost: number };
export type FinancialExchangeItem = { productId: number; productName: string; quantity: number; lineTotal: number; ingredientSnapshots: FinancialIngredientSnapshot[] };
export type FinancialExchange = { id: number; saleItemId: number; returnedQuantity: number; returnedTotal: number; replacementTotal: number; items: FinancialExchangeItem[] };
export type FinancialSaleLine = { id: number; productId: number; productName: string; quantity: number; unitPrice: number; lineTotal: number; refundedQuantity: number; exchanges: FinancialExchange[]; ingredientSnapshots: FinancialIngredientSnapshot[] };
export type FinancialSale = { id: number; status: "completed" | "partially_refunded" | "voided" | "refunded"; completedAt: Date; lines: FinancialSaleLine[] };

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
export const cogsForSnapshots = (snapshots: FinancialIngredientSnapshot[], quantity = 1) => round(snapshots.reduce((sum, snapshot) => sum + snapshot.unitQuantity * snapshot.unitCost * quantity, 0));
export const percentage = (numerator: number, denominator: number) => denominator > 0 ? round((numerator / denominator) * 100) : 0;

export type FinancialTotals = { revenue: number; cogs: number; grossProfit: number; grossMargin: number; saleCount: number; unitsSold: number };
export type ProductPerformance = { productId: number; productName: string; quantity: number; revenue: number; cogs: number; grossProfit: number; grossMargin: number };
export type ProductFinancialHistory = {
  id: string;
  saleId: number;
  receiptNumber?: string;
  occurredAt: Date;
  source: "sale" | "exchange";
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  unitCogs: number;
  status: FinancialSale["status"];
  includedInPeriod: boolean;
  ingredientSnapshots: FinancialIngredientSnapshot[];
};

function blankTotals(): FinancialTotals { return { revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, saleCount: 0, unitsSold: 0 }; }
function addProduct(products: Map<number, ProductPerformance>, product: Omit<ProductPerformance, "grossProfit" | "grossMargin">) {
  const current = products.get(product.productId) ?? { ...product, quantity: 0, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0 };
  current.quantity += product.quantity;
  current.revenue += product.revenue;
  current.cogs += product.cogs;
  products.set(product.productId, current);
}

export function summarizeFinancialSales(sales: FinancialSale[]) {
  const totals = blankTotals();
  const products = new Map<number, ProductPerformance>();
  const saleSummaries = sales.map((sale) => {
    if (sale.status === "voided" || sale.status === "refunded") return { saleId: sale.id, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, unitsSold: 0 };
    const summary = { saleId: sale.id, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0, unitsSold: 0 };
    sale.lines.forEach((line) => {
      const returnedQuantity = line.refundedQuantity + line.exchanges.reduce((sum, exchange) => sum + exchange.returnedQuantity, 0);
      const retainedQuantity = line.quantity - returnedQuantity;
      const unitCogs = cogsForSnapshots(line.ingredientSnapshots);
      const retainedRevenue = round(line.unitPrice * retainedQuantity);
      const retainedCogs = round(unitCogs * retainedQuantity);
      summary.revenue += retainedRevenue;
      summary.cogs += retainedCogs;
      summary.unitsSold += retainedQuantity;
      if (retainedQuantity > 0) addProduct(products, { productId: line.productId, productName: line.productName, quantity: retainedQuantity, revenue: retainedRevenue, cogs: retainedCogs });
      line.exchanges.forEach((exchange) => exchange.items.forEach((item) => {
        const itemCogs = cogsForSnapshots(item.ingredientSnapshots, item.quantity);
        summary.revenue += item.lineTotal;
        summary.cogs += itemCogs;
        summary.unitsSold += item.quantity;
        addProduct(products, { productId: item.productId, productName: item.productName, quantity: item.quantity, revenue: item.lineTotal, cogs: itemCogs });
      }));
    });
    summary.revenue = round(summary.revenue);
    summary.cogs = round(summary.cogs);
    summary.grossProfit = round(summary.revenue - summary.cogs);
    summary.grossMargin = percentage(summary.grossProfit, summary.revenue);
    totals.revenue += summary.revenue;
    totals.cogs += summary.cogs;
    totals.unitsSold += summary.unitsSold;
    totals.saleCount += 1;
    return summary;
  });
  totals.revenue = round(totals.revenue);
  totals.cogs = round(totals.cogs);
  totals.grossProfit = round(totals.revenue - totals.cogs);
  totals.grossMargin = percentage(totals.grossProfit, totals.revenue);
  const productPerformance = Array.from(products.values()).map((product) => ({ ...product, quantity: round(product.quantity, 3), revenue: round(product.revenue), cogs: round(product.cogs), grossProfit: round(product.revenue - product.cogs), grossMargin: percentage(product.revenue - product.cogs, product.revenue) })).sort((left, right) => right.grossProfit - left.grossProfit || right.revenue - left.revenue || left.productName.localeCompare(right.productName, "id-ID"));
  return { ...totals, productPerformance, saleSummaries };
}

export function summarizeProductFinancialDetail(productId: number, sales: Array<FinancialSale & { receiptNumber?: string }>) {
  const summary = summarizeFinancialSales(sales);
  const performance = summary.productPerformance.find((product) => product.productId === productId) ?? { productId, productName: "", quantity: 0, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0 };
  const history: ProductFinancialHistory[] = [];
  sales.forEach((sale) => sale.lines.forEach((line) => {
    const finalized = sale.status === "voided" || sale.status === "refunded";
    if (line.productId === productId) {
      const returnedQuantity = line.refundedQuantity + line.exchanges.reduce((sum, exchange) => sum + exchange.returnedQuantity, 0);
      const retainedQuantity = finalized ? 0 : Math.max(0, line.quantity - returnedQuantity);
      const unitCogs = cogsForSnapshots(line.ingredientSnapshots);
      const revenue = round(line.unitPrice * retainedQuantity);
      const cogs = round(unitCogs * retainedQuantity);
      history.push({ id: `sale-${sale.id}-${line.id}`, saleId: sale.id, receiptNumber: sale.receiptNumber, occurredAt: sale.completedAt, source: "sale", quantity: retainedQuantity, revenue, cogs, grossProfit: round(revenue - cogs), unitCogs, status: sale.status, includedInPeriod: retainedQuantity > 0, ingredientSnapshots: line.ingredientSnapshots });
    }
    line.exchanges.forEach((exchange) => exchange.items.forEach((item) => {
      if (item.productId !== productId) return;
      const unitCogs = cogsForSnapshots(item.ingredientSnapshots);
      const quantity = finalized ? 0 : item.quantity;
      const revenue = finalized ? 0 : item.lineTotal;
      const cogs = finalized ? 0 : cogsForSnapshots(item.ingredientSnapshots, item.quantity);
      history.push({ id: `exchange-${exchange.id}-${item.productId}`, saleId: sale.id, receiptNumber: sale.receiptNumber, occurredAt: (exchange as FinancialExchange & { createdAt?: Date }).createdAt ?? sale.completedAt, source: "exchange", quantity, revenue, cogs, grossProfit: round(revenue - cogs), unitCogs, status: sale.status, includedInPeriod: quantity > 0, ingredientSnapshots: item.ingredientSnapshots });
    }));
  }));
  history.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime() || right.id.localeCompare(left.id));
  return { ...performance, history };
}
