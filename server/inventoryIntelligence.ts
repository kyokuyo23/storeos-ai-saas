export type InventoryIntelligenceIngredient = {
  id: number;
  name: string;
  unit: string;
  costPerUnit: number;
};

export type InventoryIntelligenceMovement = {
  ingredientId: number;
  type: "purchase" | "adjustment" | "waste" | "opname" | "sale" | "void" | "refund" | "partial_refund" | "exchange_return" | "exchange_sale";
  quantityDelta: number;
  balanceAfter: number;
  occurredAt: Date;
};

const round = (value: number) => Number(value.toFixed(3));
export const INVENTORY_VARIANCE_TOLERANCE = 0.001;

/**
 * Calculates expected stock strictly from the stock ledger. Manual waste, adjustments,
 * and opname are deliberately retained in actual stock so their operational impact is visible as variance.
 */
export function summarizeInventoryIntelligence(
  ingredientRows: InventoryIntelligenceIngredient[],
  movementRows: InventoryIntelligenceMovement[],
  range: { start: Date; end: Date },
) {
  const theoreticalTypes = new Set<InventoryIntelligenceMovement["type"]>(["sale", "void", "refund", "partial_refund", "exchange_return", "exchange_sale"]);
  const rows = ingredientRows.map((ingredient) => {
    const historical = movementRows.filter((movement) => movement.ingredientId === ingredient.id && movement.occurredAt < range.start);
    const inPeriod = movementRows.filter((movement) => movement.ingredientId === ingredient.id && movement.occurredAt >= range.start && movement.occurredAt < range.end);
    const openingStock = round(historical.reduce((total, movement) => total + movement.quantityDelta, 0));
    const purchases = round(inPeriod.filter((movement) => movement.type === "purchase").reduce((total, movement) => total + movement.quantityDelta, 0));
    const theoreticalDelta = inPeriod.filter((movement) => theoreticalTypes.has(movement.type)).reduce((total, movement) => total + movement.quantityDelta, 0);
    const theoreticalConsumption = round(-theoreticalDelta);
    const expectedClosingStock = round(openingStock + purchases - theoreticalConsumption);
    const latestBalance = [...historical, ...inPeriod].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()).at(-1)?.balanceAfter;
    const actualClosingStock = round(latestBalance ?? openingStock);
    const variance = round(actualClosingStock - expectedClosingStock);
    const varianceValue = round(variance * ingredient.costPerUnit);
    const status = Math.abs(variance) <= INVENTORY_VARIANCE_TOLERANCE ? "ok" as const : variance > 0 ? "over" as const : "under" as const;
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      unit: ingredient.unit,
      costPerUnit: ingredient.costPerUnit,
      openingStock,
      purchases,
      theoreticalConsumption,
      expectedClosingStock,
      actualClosingStock,
      variance,
      varianceValue,
      status,
      adjustmentQuantity: round(inPeriod.filter((movement) => movement.type === "adjustment").reduce((total, movement) => total + movement.quantityDelta, 0)),
      wasteQuantity: round(inPeriod.filter((movement) => movement.type === "waste").reduce((total, movement) => total + movement.quantityDelta, 0)),
      opnameQuantity: round(inPeriod.filter((movement) => movement.type === "opname").reduce((total, movement) => total + movement.quantityDelta, 0)),
      movementCount: inPeriod.length,
    };
  }).sort((left, right) => Math.abs(right.varianceValue) - Math.abs(left.varianceValue) || left.ingredientName.localeCompare(right.ingredientName, "id"));

  return {
    rows,
    summary: {
      ingredientCount: rows.length,
      okCount: rows.filter((row) => row.status === "ok").length,
      overCount: rows.filter((row) => row.status === "over").length,
      underCount: rows.filter((row) => row.status === "under").length,
      totalAbsoluteVarianceValue: round(rows.reduce((total, row) => total + Math.abs(row.varianceValue), 0)),
      topVariances: rows.slice(0, 5),
    },
  };
}
