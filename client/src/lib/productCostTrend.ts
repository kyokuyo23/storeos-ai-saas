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
  comparison?: { previousTrend?: IngredientCostTrend; currentRange: DateRange; previousRange: DateRange };
};

export type CostChange = {
  previousCost: number | null;
  difference: number;
  percentage: number | null;
  direction: "initial" | "increase" | "decrease" | "unchanged" | "from_zero";
  isPriceSpike: boolean;
};

export type LargestCostIncrease = {
  ingredientId: number;
  name: string;
  unit: string;
  occurredAt: Date;
  previousCost: number;
  unitCost: number;
  difference: number;
  percentage: number;
};

export type DateRange = { startDate: string; endDate: string };

export type IngredientPeriodCostComparison = {
  ingredientId: number;
  name: string;
  unit: string;
  currentUnitCost: number | null;
  previousUnitCost: number | null;
  change: CostChange | null;
};

export const COST_SPIKE_THRESHOLD_PERCENT = 10;

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
  if (previousCost === undefined) return { previousCost: null, difference: 0, percentage: null, direction: "initial", isPriceSpike: false };
  const difference = unitCost - previousCost;
  if (previousCost === 0) {
    if (unitCost === 0) return { previousCost, difference, percentage: 0, direction: "unchanged", isPriceSpike: false };
    return { previousCost, difference, percentage: null, direction: "from_zero", isPriceSpike: false };
  }
  const percentage = (difference / previousCost) * 100;
  return { previousCost, difference, percentage, direction: difference > 0 ? "increase" : difference < 0 ? "decrease" : "unchanged", isPriceSpike: percentage > COST_SPIKE_THRESHOLD_PERCENT };
}

export function getLargestCostIncrease(trends: IngredientCostTrend[]): LargestCostIncrease | null {
  const candidates = trends.flatMap((trend) => trend.points.slice(1).flatMap((point, index) => {
    const change = getConsecutiveCostChange(trend.points[index]?.unitCost, point.unitCost);
    if (change.direction !== "increase" || change.previousCost === null || change.percentage === null) return [];
    return [{
      ingredientId: trend.ingredientId,
      name: trend.name,
      unit: trend.unit,
      occurredAt: point.occurredAt,
      previousCost: change.previousCost,
      unitCost: point.unitCost,
      difference: change.difference,
      percentage: change.percentage,
    }];
  }));
  return candidates.sort((left, right) => right.difference - left.difference || right.percentage - left.percentage || right.occurredAt.getTime() - left.occurredAt.getTime())[0] ?? null;
}

function parseCalendarDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function toCalendarDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getPreviousEquivalentPeriod(range: DateRange): DateRange {
  const start = parseCalendarDate(range.startDate);
  const end = parseCalendarDate(range.endDate);
  const durationDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - durationDays + 1);
  return { startDate: toCalendarDate(previousStart), endDate: toCalendarDate(previousEnd) };
}

export function buildIngredientPeriodCostComparison(currentTrends: IngredientCostTrend[], previousTrends: IngredientCostTrend[]): IngredientPeriodCostComparison[] {
  const currentByIngredient = new Map(currentTrends.map((trend) => [trend.ingredientId, trend]));
  const previousByIngredient = new Map(previousTrends.map((trend) => [trend.ingredientId, trend]));
  const ingredientIds = new Set(Array.from(currentByIngredient.keys()).concat(Array.from(previousByIngredient.keys())));
  return Array.from(ingredientIds).map((ingredientId) => {
    const current = currentByIngredient.get(ingredientId);
    const previous = previousByIngredient.get(ingredientId);
    const currentUnitCost = current?.points.at(-1)?.unitCost ?? null;
    const previousUnitCost = previous?.points.at(-1)?.unitCost ?? null;
    return {
      ingredientId,
      name: current?.name ?? previous?.name ?? "Bahan resep tersimpan",
      unit: current?.unit ?? previous?.unit ?? "",
      currentUnitCost,
      previousUnitCost,
      change: currentUnitCost === null || previousUnitCost === null ? null : getConsecutiveCostChange(previousUnitCost, currentUnitCost),
    };
  }).sort((left, right) => left.name.localeCompare(right.name, "id-ID"));
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
