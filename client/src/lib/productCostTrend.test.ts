import { describe, expect, it } from "vitest";
import { buildIngredientCostTrends, getConsecutiveCostChange, makeCostTrendGeometry } from "./productCostTrend";

describe("immutable ingredient cost trends", () => {
  it("groups and chronologically sorts immutable ingredient snapshots without using current ingredient cost", () => {
    const trends = buildIngredientCostTrends([
      { id: "sale-2", occurredAt: "2026-08-19T03:00:00.000Z", ingredients: [{ ingredientId: 4, unitCost: 1250, unitQuantity: 0.2, ingredient: { name: "Susu", unit: "ml" } }] },
      { id: "sale-1", occurredAt: "2026-08-18T03:00:00.000Z", ingredients: [{ ingredientId: 4, unitCost: 1000, unitQuantity: 0.2, ingredient: { name: "Susu", unit: "ml" } }, { ingredientId: 7, unitCost: 500, unitQuantity: 12, ingredient: { name: "Kopi", unit: "g" } }] },
    ]);
    expect(trends).toHaveLength(2);
    expect(trends[1]).toMatchObject({ ingredientId: 4, name: "Susu", points: [{ unitCost: 1000 }, { unitCost: 1250 }] });
  });

  it("creates a readable non-flat geometry for a single immutable cost observation", () => {
    const geometry = makeCostTrendGeometry([{ id: "snapshot-1", occurredAt: new Date("2026-08-19T03:00:00.000Z"), unitCost: 1200, unitQuantity: 0.2 }]);
    expect(geometry.coordinates[0]).toMatchObject({ x: 340 });
    expect(geometry.min).toBeLessThan(1200);
    expect(geometry.max).toBeGreaterThan(1200);
    expect(geometry.path).toContain(",");
  });

  it("calculates percentage changes from each consecutive immutable snapshot and handles zero-cost bases safely", () => {
    expect(getConsecutiveCostChange(1000, 1250)).toMatchObject({ difference: 250, percentage: 25, direction: "increase" });
    expect(getConsecutiveCostChange(1250, 1000)).toMatchObject({ difference: -250, percentage: -20, direction: "decrease" });
    expect(getConsecutiveCostChange(0, 0)).toMatchObject({ percentage: 0, direction: "unchanged" });
    expect(getConsecutiveCostChange(0, 500)).toMatchObject({ percentage: null, direction: "from_zero" });
  });

  it("attaches each chart point to the immediately prior snapshot change", () => {
    const geometry = makeCostTrendGeometry([
      { id: "snapshot-1", occurredAt: new Date("2026-08-18T03:00:00.000Z"), unitCost: 1000, unitQuantity: 0.2 },
      { id: "snapshot-2", occurredAt: new Date("2026-08-19T03:00:00.000Z"), unitCost: 1250, unitQuantity: 0.2 },
    ]);
    expect(geometry.coordinates[0].change).toMatchObject({ direction: "initial" });
    expect(geometry.coordinates[1].change).toMatchObject({ percentage: 25, direction: "increase" });
  });
});
