export type ProductCostHistoryEntry = {
  id: string;
  occurredAt: Date | string;
  ingredients: Array<{
    ingredientId?: number;
    unitCost: number;
    unitQuantity: number;
    ingredient?: { id?: number; name: string; unit: string } | null;
  }>;
};

export type IngredientCostTrend = {
  ingredientId: number;
  name: string;
  unit: string;
  points: Array<{ id: string; occurredAt: Date; unitCost: number; unitQuantity: number }>;
};

export type CostChange = {
  previousCost: number | null;
  difference: number;
  percentage: number | null;
  direction: "initial" | "increase" | "decrease" | "unchanged" | "from_zero";
};

export function buildIngredientCostTrends(history: ProductCostHistoryEntry[]): IngredientCostTrend[] {
  const trends = new Map<number, IngredientCostTrend>();
  history.forEach((entry) => entry.ingredients.forEach((snapshot, index) => {
    if (!snapshot.ingredientId) return;
    const ingredient = snapshot.ingredient;
    const trend = trends.get(snapshot.ingredientId) ?? {
      ingredientId: snapshot.ingredientId,
      name: ingredient?.name ?? "Bahan resep tersimpan",
      unit: ingredient?.unit ?? "",
      points: [],
    };
    trend.points.push({ id: `${entry.id}-${snapshot.ingredientId}-${index}`, occurredAt: new Date(entry.occurredAt), unitCost: snapshot.unitCost, unitQuantity: snapshot.unitQuantity });
    trends.set(snapshot.ingredientId, trend);
  }));
  return Array.from(trends.values())
    .map((trend) => ({ ...trend, points: trend.points.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id)) }))
    .sort((left, right) => left.name.localeCompare(right.name, "id-ID"));
}

export function getConsecutiveCostChange(previousCost: number | undefined, unitCost: number): CostChange {
  if (previousCost === undefined) return { previousCost: null, difference: 0, percentage: null, direction: "initial" };
  const difference = unitCost - previousCost;
  if (previousCost === 0) {
    if (unitCost === 0) return { previousCost, difference, percentage: 0, direction: "unchanged" };
    return { previousCost, difference, percentage: null, direction: "from_zero" };
  }
  const percentage = (difference / previousCost) * 100;
  return { previousCost, difference, percentage, direction: difference > 0 ? "increase" : difference < 0 ? "decrease" : "unchanged" };
}

export function makeCostTrendGeometry(points: IngredientCostTrend["points"], width = 640, height = 224) {
  const inset = { top: 20, right: 16, bottom: 34, left: 56 };
  const costs = points.map((point) => point.unitCost);
  const rawMin = Math.min(...costs);
  const rawMax = Math.max(...costs);
  const rawSpan = Math.max(rawMax - rawMin, rawMax * 0.12, 1);
  const min = Math.max(0, rawMin - rawSpan * 0.14);
  const max = rawMax + rawSpan * 0.14;
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    change: getConsecutiveCostChange(points[index - 1]?.unitCost, point.unitCost),
    x: inset.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: inset.top + ((max - point.unitCost) / (max - min || 1)) * plotHeight,
  }));
  return { width, height, inset, min, max, coordinates, path: coordinates.map((point) => `${point.x},${point.y}`).join(" ") };
}
