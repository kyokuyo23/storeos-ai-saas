import { describe, expect, it } from "vitest";
import { buildIngredientCostTrends, makeCostTrendGeometry } from "./productCostTrend";

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
});
